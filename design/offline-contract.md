# Offline Contract — TrainerApp

**Phase 0 artifact**
**Last updated:** 2026-06-17

---

## The contract

The offline contract defines which features work without a network connection, which degrade gracefully, and which are hard-blocked. This is a binding design decision — changes require explicit agreement and testing.

**Core guarantee:** A user who is mid-session when the network drops will not lose their workout. Set logging, adding exercises, and completing a session all queue offline and sync on reconnect.

**Known constraint:** Starting a new session requires network. If a user is fully offline before they begin, they cannot start. This is an acknowledged gap — UUID-based offline session creation is in the backlog.

---

## Feature status

### Always works offline

These features are either precached or served from TanStack Query in-memory cache (data loaded before going offline remains available).

| Feature | Mechanism | Notes |
|---------|-----------|-------|
| App shell loads | Workbox precache | All JS, CSS, HTML, icons, fonts precached on SW install. App launches without network. |
| Exercise library (read) | Workbox NetworkFirst, 24h TTL | Prefetched by `syncService` on app load. Available offline from `api-reference-cache`. |
| Body parts taxonomy (read) | Workbox NetworkFirst, 24h TTL | Static reference data. Never changes in practice. |
| Templates (read) | Workbox NetworkFirst, 24h TTL | Template list and detail served from `api-reference-cache` if previously loaded. |
| Cloudinary progress photos (display) | Workbox CacheFirst, 30-day TTL | Photos cached on first view. Displayed offline from `cloudinary-media` cache. |
| Dashboard (stale data) | TanStack Query in-memory cache | Widgets show last-loaded data. "Last updated" timestamp visible if stale. |
| Session history (stale data) | TanStack Query in-memory cache | Past sessions readable from cache within the current app session. |

---

### Works offline — writes queued

These four mutation paths use `offlineAwareApi` and queue to IndexedDB `offlineQueue` when `navigator.onLine === false`. They replay on reconnect via `syncService.flushQueue()`.

| Operation | API call | Queued | Notes |
|-----------|----------|--------|-------|
| **Log a set** | `POST /session-exercises/:id/sets` | ✅ | Primary offline use case. Set appears immediately in UI (optimistic). |
| **Add workout to session** | `POST /sessions/:id/workouts` | ✅ | Adding a new workout block mid-session while offline. |
| **Add exercise to workout** | `POST /workouts/:id/exercises` | ✅ | Adding an exercise to a block mid-session while offline. |
| **Complete a session** | `PATCH /sessions/:id` (status + subjective scores) | ✅ | The session summary submit queues if offline at completion. |

**Flush order on reconnect:** workouts → sessionExercises → sets (parent before child, always).

**Idempotent replay:** each queued op carries an `Idempotency-Key` (a UUID generated when the op is first attempted and reused on every replay), sent as the `Idempotency-Key` header on both the initial online attempt and the queued replay. The server records the key with the response it produced; a replay of a write the server already processed — but whose response was lost — returns the **stored response** instead of inserting a duplicate. This is what makes replay safe: without it, a set logged offline whose 201 never reached the client would be inserted twice on the next flush. Because the stored response is replayed verbatim, downstream child ops still resolve the server-generated parent id. Backend: `lib/idempotency.ts` + `idempotency_keys` table. Old ops queued before this existed carry no key → the server treats them as before (no dedup).

**Sync log:** every successfully replayed item writes a `sync_log` entry server-side with `createdLocallyAt` (from `X-Local-Timestamp` header if present) and `syncedAt` (server time).

**PR detection:** does not run for offline-logged sets. `isPR` is always `false` for queued sets until a post-sync recompute pass runs. This is a known gap — `POST /session-exercises/:id/recompute-prs` is in the backlog.

---

### Blocked offline — requires network

These operations use direct `apiClient` calls with no offline queue. They fail immediately if the network is down. The UI must surface a clear "you need internet for this" message — never a generic error.

#### Session management
| Operation | Why not queued |
|-----------|---------------|
| **Create a new session** (`POST /sessions`) | The session `id` is server-generated and is required by all downstream operations (workouts, exercises, sets). Without it, the queue chain cannot be built. *Backlog: accept client-generated UUID to unblock this.* |
| Edit set after logging (`PATCH /sets/:id`) | Post-hoc edits are low-frequency; not worth the queue complexity. |
| Remove a workout from session | Destructive; ordering and referential integrity require server confirmation. |
| Remove an exercise from session | Same as above. |
| Rename a session | Non-critical; can wait for reconnect. |
| Delete a session | Destructive; not safe to queue. |
| Reorder workouts / exercises | High-frequency during planning; debounced but not queued. |

#### Athlete profile
| Operation | Why not queued |
|-----------|---------------|
| **Add a goal** | Not currently offline-aware. High-value candidate for queueing in a future pass. |
| Edit / soft-delete a goal | Not queued. |
| **Capture a snapshot** | Not currently offline-aware. High-value candidate for queueing. |
| Attach a progress photo | Requires Cloudinary upload — network dependency is inherent. |

#### Client roster (Trainer only)
| Operation | Why not queued |
|-----------|---------------|
| Add / edit / deactivate a client | Roster mutations are not a gym-floor workflow. Network dependency acceptable. |
| Add / edit / delete a client goal | Same as Athlete goal — not queued. |
| Send a monthly report | Requires email dispatch — inherently online. |

#### Templates
| Operation | Why not queued |
|-----------|---------------|
| Create / edit / delete a template | Template authoring is a planning-time activity, not gym-floor. |
| Add / remove workouts or exercises from a template | Same. |

#### Auth
| Operation | Why not queued |
|-----------|---------------|
| Register | Always requires network — cannot create an account offline. |
| Login (initial) | Always requires network. |
| Token refresh | Silent refresh fires on app load — if offline and access token is expired, user sees an "offline, please connect to log in" screen rather than a generic 401. |

---

## Caching strategy — by resource type

Implemented in `apps/frontend/vite.config.ts` via Workbox (vite-plugin-pwa).

| Resource | Strategy | TTL / Cap | Rationale |
|----------|----------|-----------|-----------|
| **App shell** (JS, CSS, HTML, icons, fonts) | Precache on SW install | Versioned — old cache purged on SW activate | Must load instantly. Changes only on deploy. |
| **Static assets** (images in `public/`) | Precache on SW install | Versioned | Same as app shell. |
| **Exercise library** (`/api/v1/exercises`) | NetworkFirst | 24h, 50 entries | Changes rarely; no PII; safe to serve stale. Network checked first so deploys are picked up quickly. |
| **Body parts** (`/api/v1/body-parts`) | NetworkFirst | 24h, 50 entries | Static reference; never changes in practice. |
| **Templates** (`/api/v1/templates`) | NetworkFirst | 24h, 50 entries | Blueprint data; no PII; safe to serve offline. |
| **Cloudinary media** (`res.cloudinary.com`) | CacheFirst | 30 days, 200 entries | Photos are immutable once uploaded. Cache-first minimises bandwidth. |
| **Auth routes** (`/auth/*`) | **Not cached** | — | Tokens and session data must always be fresh. |
| **Client data** (`/clients/*`) | **Not cached** | — | PII — health data, personal records. Never served stale. |
| **Sessions** (`/sessions/*`, `/sets/*`) | **Not cached** | — | Training records. PII-adjacent. Served fresh or from TanStack Query in-memory cache. |
| **Snapshots** (`/snapshots/*`) | **Not cached** | — | Body measurements. PII. |
| **KPIs** (`/kpis/*`) | **Not cached** | — | Computed from health data. Must be accurate. |
| **Reports** (`/reports/*`) | **Not cached** | — | Client-facing documents. |

**TanStack Query in-memory cache** acts as a secondary read layer for all non-precached data. Data fetched before going offline is readable within the same app session. This cache is not persisted — a page reload clears it.

---

## Offline detection

The app detects offline state via `navigator.onLine` polled by `useOnlineStatus()`, which listens to `window online` and `window offline` events.

**Caveat:** `navigator.onLine` can return `true` while the device has no real connectivity (e.g. connected to a WiFi router with no internet). In this case, the app will attempt online API calls, receive network errors, and the `offlineAwareApi` will not auto-queue (it only queues when `navigator.onLine === false`). The user sees a fetch error rather than the offline banner. This is a known limitation of the Web platform — it does not affect the core gym-floor use case where network drops are typically detected correctly.

---

## OfflineBanner state machine

The persistent sync status indicator (`OfflineBanner`) communicates sync state without interrupting the user.

```
hidden (online, nothing pending)
  ↓  network drops
offline — no pending writes
  ↓  user logs a set
offline — N writes queued  ("3 changes queued")
  ↓  network restores
syncing…  ("Syncing 3 changes")
  ↓  all succeed
hidden
  ↓  one or more fail (after MAX_RETRIES)
error — tap to retry
  ↓  user taps / retries
syncing…
```

---

## Known gaps

| Gap | Impact | Backlog item |
|-----|--------|-------------|
| Session creation requires network | Cannot start a new session while fully offline | UUID-based offline session creation |
| Goal creation not offline-aware | Goals created offline are lost | Add to `offlineAwareApi` queue |
| Snapshot creation not offline-aware | Snapshots created offline are lost | Add to `offlineAwareApi` queue |
| PR detection skipped for offline sets | PRs earned during offline sessions not flagged until recompute | `POST /session-exercises/:id/recompute-prs` |
| `navigator.onLine` false-positive | App may attempt online calls when actually offline on captive networks | Service worker fetch interception (future) |
| No offline fallback screens audited | Some routes may show blank or broken states rather than a cached/offline message | Full offline fallback screen audit (kano.md Must-be gap) |
