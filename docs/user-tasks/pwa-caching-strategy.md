# PWA Caching Strategy — Decisions and Rationale

> Written after Phase 8 (Testing). Describes the caching layer as it exists in
> `src/sw.ts`, `services/offlineQueue.ts`, and `services/syncService.ts`,
> with the reasoning behind each decision.

---

## Layer overview

The offline strategy has two distinct layers:

| Layer | Handles | Implementation |
|---|---|---|
| **Read cache** | GET requests, static assets, media | Workbox (SW) |
| **Write queue** | POST/PATCH/DELETE while offline | `offlineQueue.ts` + `syncService.ts` |

Reads and writes are separated intentionally. Workbox handles reads transparently; the write queue is explicit and auditable.

---

## Static assets — Precache

**Strategy:** Precache (install-time)
**File:** `precacheAndRoute(self.__WB_MANIFEST)` in `src/sw.ts`

All Vite build outputs (JS bundles, CSS, icons, `index.html`) are precached at SW install time. This means the full app shell is available offline after the first visit with no further action required.

**Why precache and not runtime caching for assets?**
Vite adds content hashes to every bundle filename. A file at `assets/index-Bx3kq8.js` is immutable — once cached it never needs revalidation. Precaching is the correct strategy for immutable assets: the SW caches them once, serves them forever, and only evicts them when a new SW version replaces them with new hashes.

**Cleanup:** `cleanupOutdatedCaches()` runs on activation and removes cache entries for assets from previous builds. Without this, old hashed bundles accumulate in Cache Storage indefinitely.

---

## SPA navigation — NavigationRoute fallback

**Strategy:** Serve `index.html` from precache for all navigation requests
**File:** `NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api/] })`

When the user navigates directly to `/session/abc/summary` (or any client-side route) while offline, the browser asks the SW for that URL. Without a fallback, it would get a network error. With `NavigationRoute`, the SW returns the cached `index.html`, React loads, and the router renders the right page.

**Why denylist `/api`?** API routes should fail loudly when offline so the app can show the correct offline state. Returning `index.html` for an API request would produce a confusing HTML response where JSON was expected.

---

## Reference data — NetworkFirst (24h stale)

**Strategy:** NetworkFirst, 24-hour max age, 50-entry cap
**File:** Matches `/api/v1/(exercises|body-parts|templates)`

These three endpoints are the read-heavy reference tables that change rarely (exercise library, body part taxonomy, templates). They carry no PII and a trainer mid-session can safely work with data that's up to 24 hours old.

**Why NetworkFirst and not CacheFirst?**
NetworkFirst tries the network first and falls back to cache. This means trainers always get fresh data when connected, and stale data when offline. CacheFirst would serve stale data even when the network is available, which would mask exercise library updates.

**Why not cache session data or client data?**
Session and client data change constantly (every logged set updates the session) and carry PII. Serving stale session data could corrupt a mid-workout log. These requests are not cached at the SW layer — they either succeed (online) or get queued (offline, writes only).

---

## Media — CacheFirst (30 days)

**Strategy:** CacheFirst, 30-day expiry, 200-entry cap
**File:** Matches `https://res.cloudinary.com`

Exercise illustration images and progress photos are uploaded once and never change at the same URL. This makes them ideal for CacheFirst: the first load fetches from Cloudinary, subsequent loads are instant from cache.

**Why CacheFirst and not NetworkFirst?**
These are immutable assets served from a CDN. Checking the network first on every load adds latency with no benefit — the cached version is always correct.

**Entry cap (200):** Prevents unbounded growth for accounts with many progress photos. When the cap is reached, Workbox evicts the least-recently-used entry. The evicted image will be re-fetched from Cloudinary on next access.

---

## Write queue — localStorage (not IndexedDB)

**File:** `services/offlineQueue.ts`
**Storage:** `localStorage` under key `trainer-app-offline-queue`

Offline writes (set logging, session start/end, exercise additions) are queued as a JSON array in localStorage.

**Why localStorage and not IndexedDB?**
- The write volume is low. A typical offline session generates 10–50 queue entries. localStorage handles this easily.
- localStorage is synchronous. The queue can be read and written in the same tick as the user action — no async overhead at the point of use.
- IndexedDB is significantly more complex to implement correctly (transactions, cursor-based reads, error handling). The complexity isn't justified at current write volumes.

**Upgrade path is defined:** The `OfflineQueue` interface in `offlineQueue.ts` is storage-agnostic. Swapping to IndexedDB means implementing the same interface in `offlineQueueIDB.ts` and changing one export line. `syncService.ts` and all callers are unchanged. This is a v3.x concern.

**Why not the SW's built-in Background Sync queue (Workbox BackgroundSyncPlugin)?**
Workbox's background sync stores writes in IndexedDB internally. It replays them automatically when online, but gives you no visibility into the queue (no count, no list, no description per entry). The trainer-facing sync indicator (`SyncStatusProvider`) needs to show pending count and per-operation descriptions ("Logging set — Squat"). The custom queue makes this possible.

---

## Write sync — two triggers

**File:** `services/syncService.ts`

Queued writes are flushed in two scenarios:

1. **`window.online` event** — tab is open when connectivity returns
2. **SW message relay** — SW receives a `sync` event (from the Background Sync API) and posts `FLUSH_QUEUE` to all window clients. This covers the case where connectivity returned while the tab was closed.

The Background Sync API is registered in `offlineQueue.enqueue()` on every write. This ensures the browser schedules a retry even if the user closes the app before reconnecting.

---

## Decisions not made (deferred)

| Item | Status |
|---|---|
| IndexedDB write queue | Deferred to v3.x. Interface is ready, swap is one line. |
| Push notifications | Deferred past SaaS launch (product-synthesis.md). VAPID keys not generated. |
| Background sync for reads | Not implemented. Reads are best-effort via prefetch on load. |
| Periodic background sync | Not implemented. Would require `periodic-background-sync` permission, which Chrome rarely grants. |
