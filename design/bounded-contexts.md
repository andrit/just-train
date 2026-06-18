# Bounded Contexts — TrainerApp

**Phase 0 artifact — draft for review**
**Last updated:** 2026-06-18

---

## How to read this document

A bounded context is a named boundary inside which a single, consistent model applies. The same word can mean different things in different contexts — this document makes those differences explicit and defines how contexts integrate.

**Integration pattern legend**

| Pattern | Abbreviation | Meaning |
|---------|-------------|---------|
| Customer–Supplier | CS | Upstream supplies a stable interface; downstream conforms to it |
| Shared Kernel | SK | Two contexts co-own a piece of the model; changes require joint agreement |
| Anti-corruption Layer | ACL | Downstream translates upstream model into its own language via an adapter |
| Published Language | PL | Upstream publishes a versioned event/schema that any context may subscribe to |
| Conformist | CF | Downstream accepts the upstream model as-is, without translation |

---

## Context map

```
┌──────────────────────────────────────────────────────────────────────┐
│                           IDENTITY                                    │
│  Trainer record · trainerMode · onboardedAt · deactivatedAt          │
│  refresh tokens · device IDs                                          │
└───────────┬──────────────────────────────────────────────────────────┘
            │  CS (upstream supplier to all contexts)
            │  Published Language: Trainer { id, trainerMode, subscriptionTier }
            ▼
┌──────────────────────────────────┐    SK    ┌──────────────────────────────┐
│           TRAINING               │◄────────►│   ATHLETE                    │
│  Session · SessionExercise · Set │          │   AthleteProfile · Goal      │
│  Exercise · Template · PR        │          │   Snapshot · ProgressPhoto   │
│  RestTimer · SessionExercise     │          │   ┄ serves both personas ┄   │
└──────────┬───────────────────────┘          │   see persona note below     │
           │                                  └──────────────────────────────┘
           │ SK (endpoint signatures —                      │
           │ Sync replays Training writes)                  │ SK: clients table
           │                                                │ (isSelf boundary)
           ▼                                                ▼
┌──────────────────────┐                   ┌───────────────────────────────────┐
│        SYNC          │                   │   ROSTER  [Trainer only]          │
│  OfflineQueue        │                   │   Client · AtRisk · Challenge     │
│  QueueFlush          │                   └──────────────┬────────────────────┘
│  SyncLog             │                                  │
└──────────────────────┘                   CS (supplier)  │
                                                          ▼
                                           ┌───────────────────────────────────┐
                                           │   INSIGHT  [Trainer only]         │
                                           │   MonthlyReport · KPI · TrendData │
                                           └───────────────┬───────────────────┘
                                                           │
                                           ┌───────────────▼───────────┐
                                           │   [EXT] Email Provider     │
                                           └───────────────────────────┘

BILLING (writes subscriptionTier / subscriptionStatus back to IDENTITY's trainers row)
  ├── Inbound: Identity CS — trainerId; OnboardingCompleted (trainer) → Trial start
  ├── Outbound → Identity: subscriptionTier / subscriptionStatus updates
  └── [EXT] Stripe (Checkout, webhooks, Customer Portal)

PWA (cross-cutting — receives PL events from Training, Roster, Insight)
  ├── Training: SessionCompleted → install prompt
  ├── Roster: AtRiskThresholdCrossed → push notification (🔜)
  └── Insight: MonthlyReportSent → push notification (🔜)
  └── [EXT] Push Gateway, [EXT] Cloudinary

Persona note — ATHLETE serves two user types through the same code path:
  ├── Athlete users (trainerMode = 'athlete') — ATHLETE + TRAINING is their entire app
  └── Trainer users (trainerMode = 'trainer') via "My Training" tab — the isSelf
      client resolves into the ATHLETE context, never into ROSTER
Persona note — ROSTER and INSIGHT are gated by trainerMode = 'trainer'
  └── Together they define the coaching half of the Trainer experience
```

---

## Shared kernel: Client

The `Client` aggregate is co-owned by **Athlete** and **Roster**. It is the single most important cross-context boundary in the system.

```
clients table
├── id (PK)
├── trainerId (FK → trainers)
├── name, email, notes
├── isSelf (boolean)          ← the seam between the two contexts
├── isAtRisk (boolean)        ← owned by Roster
├── focus, weightUnit          ← owned by Training / Athlete preferences
└── ...
```

| Context | How it sees Client | Language used | What isSelf means |
|---------|------------------|---------------|-------------------|
| **Roster** | An external person being coached | "Client", "your client", "client roster" | Hidden — excluded from roster queries via `WHERE isSelf = false` |
| **Athlete** | A training subject (may be self or a client) | "Your profile", "your training", "My Training" | The Trainer's own Athlete experience — treated identically by the backend |

**Rule:** The `isSelf` flag is the only discriminator. The backend never branches on it — all operations (sessions, goals, snapshots) work the same for `isSelf = true` and `isSelf = false`. Only the frontend applies the language and UI difference.

**Joint agreement required when:** adding columns to `clients`, changing cascade rules, or altering how `isSelf` is set. Both Athlete and Roster UIs must be reviewed.

---

---

## 1. Identity

### Responsibility

Establishes who is using the system, what mode they are in, and what they are allowed to do. All other contexts receive the Trainer record as a given — they do not re-derive identity.

### Aggregates and key fields

| Aggregate | Table | Key fields |
|-----------|-------|-----------|
| Trainer | `trainers` | `id`, `trainerMode`, `onboardedAt`, `subscriptionTier`, `trainerRole`, all preference columns |
| RefreshToken | `refresh_tokens` | `trainerId`, `deviceId`, `token`, `expiresAt` |
| Device | (logical, keyed by `X-Device-ID` header) | `deviceId` (UUID in `localStorage`) |

### Ubiquitous language (Identity context)

| Term | Meaning here |
|------|-------------|
| **Trainer** | Any registered user — whether they train others or only themselves. The system-wide user record. |
| **trainerMode** | `'athlete'` or `'trainer'` — the mode chosen at onboarding. Gates navigation and feature access. |
| **onboardedAt** | The timestamp mode selection was completed. `null` = not yet onboarded; `OnboardingGate` catches this. |
| **Device** | A browser instance identified by a stable UUID in `localStorage`. Scopes refresh tokens. |
| **Access token** | JWT (15 min TTL); lives in Zustand memory only. Never persisted to disk. |
| **Refresh token** | 7-day token; lives in an httpOnly cookie only. Never readable by JavaScript. |

### What Identity owns

- `trainers` row creation and updates
- `refresh_tokens` table
- JWT issuance and rotation
- Mode selection (`trainerMode`, `onboardedAt`)
- isSelf Client creation (triggered here, as part of the registration transaction)
- All preference fields on `trainers` (ctaLabel, alertsEnabled, widgetProgression, etc.)

### What Identity does NOT own

- Client records (beyond the auto-created isSelf one)
- Sessions, sets, or any training data
- Report generation

### Integration (outbound)

| Downstream context | Pattern | What Identity supplies |
|-------------------|---------|----------------------|
| Training | CS | `Trainer { id, trainerMode }` on every authenticated request via `request.trainer` |
| Athlete | CS | `Trainer { id }` scoping all profile queries |
| Roster | CS | `Trainer { id, trainerMode }` — Roster is only accessible when `trainerMode = 'trainer'` |
| Insight | CS | `Trainer { id, autoReportEnabled, timezone }` for report scheduling |
| PWA | CS | `Trainer { id }` for push subscription storage |
| Sync | CS | `Trainer { id }` scoping sync_log entries |
| Billing | PL | `TrainerRegistered` event → Billing creates Stripe Customer; Billing writes `subscriptionTier` / `subscriptionStatus` back to the `trainers` row |

### Implementation

| Layer | Location |
|-------|----------|
| Schema | `src/db/schema/auth.ts` (refresh_tokens), `src/db/schema/trainers.ts` (trainers + clients isSelf) |
| Routes | `src/routes/auth.ts` |
| Frontend store | `src/store/authStore.ts` |
| Frontend hook | `src/hooks/usePreferences.ts` |
| Gate component | `src/components/auth/AuthProvider.tsx`, `OnboardingGate` in `App.tsx` |

---

---

## 2. Training

### Responsibility

The core subdomain. Owns everything that happens during a workout: session lifecycle, set logging, PR detection, rest timer, exercise library, and templates. The most complex and most differentiating context in the system.

### Aggregates and key fields

| Aggregate | Table(s) | Key fields |
|-----------|----------|-----------|
| Session | `sessions` | `id`, `clientId`, `trainerId`, `status` (planned/building/in_progress/completed/cancelled/**partial**), `startTime`, `endTime`, `templateId`, subjective score columns |
| SessionExercise | `session_exercises` | `sessionId`, `exerciseId`, `workoutType` (inferred from exercise), `targetWeight`, `targetReps`, `sortOrder` |
| Set | `sets` | `sessionExerciseId`, `weight`, `reps`, `isPR`, `isPRVolume`, `is1rmEstimatePR`, `unit`, cardio columns |
| Exercise | `exercises` | `id`, `name`, `bodySection`, `workoutType`, `isCustom`, `trainerId` |
| Template | `templates` | `id`, `trainerId`, `name`, `description`, `type` ('session' \| 'workout') |
| TemplateExercise | `template_exercises` | `templateId`, `exerciseId`, `workoutType` (inferred), `targetWeight`, `targetReps`, `sortOrder` |

### Ubiquitous language (Training context)

| Term | Meaning here |
|------|-------------|
| **Session** | A bounded training event with a lifecycle: `planned → in_progress → completed \| partial \| cancelled` |
| **Set** | A single logged effort: weight × reps, or cardio fields (distance, duration, etc.) |
| **Personal Record (PR)** | A new best for a client on a specific exercise — either 1RM estimate (Epley) or volume (weight × reps) |
| **Body section** | The anatomical region an exercise targets (e.g. upper body, lower body, core). A property of the Exercise record. Used as a primary filter dimension in exercise search. |
| **Workout type** | The physical modality of an exercise (resistance, cardio, mobility, calisthenics). A property of the Exercise record. Carried through to SessionExercise and TemplateExercise. Used as the second primary filter dimension in exercise search. |
| **Template** | A reusable flat list of exercises with targets. `type = 'session'`: exercises may span multiple workout types. `type = 'workout'`: all exercises share one workout type (see *WorkoutTemplate*). Both are `template → template_exercises`. |
| **WorkoutTemplate** | A `type = 'workout'` template where all exercises share one workout type (e.g. a "Leg Day" or "Push" template). Built in the unified template builder with the type toggle set to "Workout". The workout-type constraint is advisory — enforced by UI, not schema. |
| **Target values** | `targetWeight` / `targetReps` from a template or prior session — the intent before the actual |
| **In-session history** | The last 3 sets for this client on this exercise, shown inline during set logging |
| **Rest timer** | Countdown started automatically after a set is logged; duration from `restDurationSeconds` preference |
| **CTA label** | The trainer's custom name for the "Start Training" button (e.g., "Let's Go", "Train Now") |

### What Training owns

- Full session lifecycle and status transitions
- Set logging and PR detection logic
- Exercise library (shared read, but Training owns the query patterns)
- Template CRUD and apply-to-session logic
- `isPR` / `isPRVolume` / `is1rmEstimatePR` flags on sets
- `restDurationSeconds`, `prNotifyType` preferences (stored on Trainer record — owned by Identity, consumed by Training)

### What Training borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| `clientId` | Shared kernel (Client) | FK on sessions, sessionExercises scope |
| `trainerId` | Identity | FK on sessions; `request.trainer` on every route |
| Template referenced by session | Internal (Template is a Training aggregate) | `templateId` FK on sessions |

### Integration (outbound)

| Downstream context | Pattern | Event / data |
|-------------------|---------|-------------|
| Athlete | PL | `SessionCompleted` → KPI recompute |
| Roster | PL | `SessionCompleted` → at-risk status update |
| PWA | PL | `SessionCompleted` → install prompt check |
| Sync | SK | Training's API surface is what Sync replays — Sync must conform to Training's endpoint signatures |
| Insight | PL | `SessionCompleted` → KPI trend update; session data consumed for report |

### Concurrent session model

- `plannedSessions` — map keyed by `sessionId`; many open at once; any client
- `activeSessions` — map keyed by `clientId`; one `in_progress` per client at a time
- The live session overlay uses the Spotify model: full-screen, swipe down to minimise to a persistent pill

### Implementation

| Layer | Location |
|-------|----------|
| Schema | `src/db/schema/sessions.ts`, `src/db/schema/templates.ts`, `src/db/schema/exercises.ts` |
| Routes | `src/routes/sessions.ts`, `src/routes/templates.ts`, `src/routes/exercises.ts` |
| Frontend pages | `LiveSessionPage`, `SessionSummaryPage`, `SessionHistoryPage`, `TemplatesPage` |
| Frontend components | `SessionLauncherSheet`, `SessionPlanPanel`, `TemplateBuilderSheet` (unified builder — type toggle selects Session vs Workout template; workout type constraint enforced for `type = 'workout'`) |

---

---

## 3. Sync

### Responsibility

Makes Training writes durable across connectivity interruptions. Translates failed online requests into queued IndexedDB operations, then replays them in dependency order when connectivity is restored. A supporting subdomain — necessary but not differentiating.

### Aggregates and key fields

| Aggregate | Store | Key fields |
|-----------|-------|-----------|
| QueueItem | IndexedDB `offlineQueue` | `method`, `path`, `body`, `description`, `enqueuedAt`, `retryCount` |
| SyncLogEntry | `sync_log` (PostgreSQL) | `trainerId`, `deviceId`, `tableName`, `recordId`, `operation`, `payload`, `createdLocallyAt`, `syncedAt` |

### Ubiquitous language (Sync context)

| Term | Meaning here |
|------|-------------|
| **Offline queue** | The IndexedDB store of write operations that failed to reach the server |
| **Queue item** | A single write: `{ method, path, body, description }` |
| **Flush** | The process of replaying the queue in dependency order when connectivity restores |
| **Replay order** | session → workouts → sessionExercises → sets (parent before child, always) |
| **Sync log** | The server-side audit table of all write operations that successfully reached the server |
| **createdLocallyAt** | When the write was originally made on the device (from `X-Local-Timestamp` header, or server time for online writes) |
| **syncedAt** | When the server processed the write — always server time |
| **Conflict** | When the same record has been mutated by two devices since their last sync point |
| **trainer-app:sync-complete** | The DOM event dispatched after a successful flush — triggers TanStack Query cache invalidation |

### What Sync owns

- `offlineQueue` (IndexedDB) — read/write
- `syncService.flushQueue()` — flush logic
- `offlineAwareApi` — the HTTP adapter that intercepts offline writes and enqueues them
- `OfflineBanner` state machine (offline → queued → syncing → error → hidden)
- `sync_log` table (server-side; written by route handlers via `logSyncWrite`)

### What Sync borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| Training's API surface | Training | SK — Sync replays exact `{ method, path, body }` against Training routes |
| `trainerId` | Identity | Written to `sync_log` entries via `request.trainer` |
| `X-Device-ID` header | Identity | Written to `sync_log.deviceId` |

### Shared kernel with Training

Sync and Training share a contract: the `path` and `body` fields in a `QueueItem` are Training API requests. If Training changes an endpoint signature, Sync must update the queue format. This is the tightest coupling in the system.

**Divergence risk:** If Training renames or restructures an endpoint (e.g., `/sessions/:id/sets` → `/sets`), any items already in the queue under the old path will fail to replay. Queue items must be treated as versioned.

### Integration (inbound / outbound)

| Direction | Context | Pattern | Description |
|-----------|---------|---------|-------------|
| Inbound | Training | SK | `offlineAwareApi` wraps Training's write operations |
| Outbound | Training | SK | Flush sends items to Training routes |
| Outbound | All | PL | `trainer-app:sync-complete` DOM event triggers cache invalidation |

### Implementation

| Layer | Location |
|-------|----------|
| Client service | `src/services/offlineQueue.ts`, `src/services/syncService.ts` |
| HTTP adapter | `src/lib/offlineAwareApi.ts` |
| UI | `src/components/shell/OfflineBanner.tsx` |
| Hook | `src/hooks/useOnlineStatus.ts` |
| Server-side | `src/services/syncLog.service.ts`, `sync_log` table in `sessions.ts` schema |

---

---

## 4. Athlete

### Responsibility

The personal training experience for a single person. Owns the profile, goals, body measurements (snapshots), and progress photos for a training subject — whether that subject is a standalone Athlete user or a Trainer accessing their own isSelf experience.

This is the context that **defines what the app is** for an Athlete. The Athlete user never leaves this context (plus Training). Everything here uses first-person language.

### Aggregates and key fields

| Aggregate | Table(s) | Key fields |
|-----------|----------|-----------|
| AthleteProfile | (projection over `clients`, `sessions`, `clientGoals`, `clientSnapshots`) | `clientId` as the identity anchor |
| Goal | `client_goals` | `clientId`, `title`, `notes`, `targetDate`, `achievedAt`, `deletedAt` |
| Snapshot | `client_snapshots` | `clientId`, `capturedBy`, `capturedAt`, 34 measurement columns (all nullable) |
| ProgressPhoto | `snapshot_media` | `snapshotId`, `pose` (front/side_left/side_right/back), `cloudinaryUrl`, `cloudinaryPublicId` |

### Ubiquitous language (Athlete context)

| Term | Meaning here |
|------|-------------|
| **Your profile** | The Athlete's personal training home: KPIs, goals, snapshot history, session timeline |
| **My Training** | The nav tab / route that enters the Athlete profile (`/my-training`) |
| **Goal** | A personal intent with a title, optional date, and eventual achievement marker |
| **Goal arc** | The full history of all goals — set, in-progress, achieved — never deleted |
| **Snapshot** | A point-in-time measurement record (up to 34 body fields, all optional) |
| **Baseline** | The earliest snapshot; all subsequent deltas are shown relative to it |
| **Delta** | The change between the current snapshot and the previous one on a given measurement |
| **Progress photo** | A photo attached to a snapshot, organized by pose (front, side left, side right, back) |
| **Comparison** | The side-by-side slider view of two snapshots' photos |
| **KPI hero** | The summary bar: streak, weekly volume, 1RM estimates, consistency score. Near-term: KPIs are pinnable from the Goals screen; pinned KPIs appear as chips in a header strip. |

### What Athlete owns

- `client_goals` table (all operations)
- `client_snapshots` table (all operations)
- `snapshot_media` table (all operations)
- `AthleteProfilePage` component — a dedicated component, not a re-use of `ClientProfilePage`
- The `/my-training` route — must render `AthleteProfilePage` directly, no redirect

### What Athlete borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| `clientId` | Shared kernel (Client) | All Athlete aggregates are scoped to a `clientId` |
| Session timeline | Training | Read from `sessions` by clientId — Athlete reads, Training owns |
| KPI computations | Training | Computed from sessions and sets — derived read models, not owned data |

### Anti-corruption layer: Athlete ↔ Roster

The same `clients` row is used by both contexts. The ACL is enforced in the **frontend** via dedicated components and routes:

| Roster vocabulary | ACL (translation) | Athlete vocabulary |
|------------------|-------------------|--------------------|
| "Client" | `AthleteProfilePage` renders self | "You" / "Your" |
| "Client roster" | Hidden entirely | Not visible |
| `/clients/:id` | `AthleteRouteGuard` blocks access | `/my-training` |
| "ClientProfilePage" | Separate component | "AthleteProfilePage" |
| "Add to roster" | N/A | N/A |

The backend has no ACL — it serves `clientId`-scoped data the same way regardless. The vocabulary and navigation separation is a pure frontend concern.

### Integration (inbound / outbound)

| Direction | Context | Pattern | Description |
|-----------|---------|---------|-------------|
| Inbound | Training | PL | `SessionCompleted` → KPI recompute for this client |
| Inbound | Identity | CS | `trainerId` / `clientId` (isSelf) scoping |
| Outbound | Insight | PL | Goal arc + snapshot data consumed by report generator |
| Outbound | PWA | PL | `GoalAchieved` → potential push notification (milestone) *(🔜)* |

### Current gaps

| Gap | Description |
|-----|-------------|
| G2 | `MyTrainingPage` redirects to `/clients/:selfClientId` instead of rendering `AthleteProfilePage` directly |
| G3 | `AthleteProfilePage` does not yet exist as a separate component |
| G1 | `AthleteRouteGuard` does not yet block `/clients` and `/clients/:id` for `trainerMode = 'athlete'` |

### Implementation

| Layer | Location |
|-------|----------|
| Schema | `src/db/schema/client-goals.ts`, `src/db/schema/client-snapshots.ts`, `src/db/schema/snapshot-media.ts` |
| Routes | `src/routes/goals.ts`, `src/routes/snapshots.ts`, (progress photos in snapshots) |
| Frontend page | `src/pages/MyTrainingPage.tsx` → target: `src/pages/AthleteProfilePage.tsx` |
| Frontend components | `SnapshotPhotoCapture`, `ProgressPhotoTimeline`, `PhotoComparisonSlider`, `KpiHero` |

---

---

## 5. Roster

### Responsibility

Manages a Trainer's external client relationships. Trainer-only. An Athlete never enters this context. Owns the client list, at-risk monitoring, and challenge assignment.

### Aggregates and key fields

| Aggregate | Table(s) | Key fields |
|-----------|----------|-----------|
| Client | `clients` (isSelf = false only) | `id`, `trainerId`, `name`, `email`, `notes`, `isAtRisk`, `focus` |
| Challenge | `challenges` | `clientId`, `trainerId`, `title`, `targetValue`, `progress`, `completedAt` |

### Ubiquitous language (Roster context)

| Term | Meaning here |
|------|-------------|
| **Client** | An external person being coached. Never `isSelf`. Appears in the roster. |
| **Roster** | The list of all external clients for a Trainer |
| **At-risk** | A client who has not completed a session in 14+ days. Flagged with amber indicators. |
| **At-risk threshold** | 14 days since last completed session — configurable in future |
| **Challenge** | A Trainer-assigned exercise or performance target with progress tracking |
| **Client profile** | The Trainer's view of a client: KPIs, goals, snapshots, session history, challenges |

### What Roster owns

- `clients` table entries where `isSelf = false`
- `challenges` table
- `isAtRisk` flag computation and storage
- The `/clients` and `/clients/:id` routes — these are Roster routes, gated for Athletes

### What Roster borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| `clientId` | Shared kernel (Client) | Roster manages the same Client records Athlete reads |
| Session history (last session date) | Training | Read from `sessions` to determine at-risk status |
| Goal arc, snapshots | Athlete | `ClientProfilePage` reads Athlete-context data for the Trainer view |

### Anti-corruption layer: Roster → Athlete

When a Trainer views their own training via "My Training", they enter the **Athlete context** — not the Roster context. The isSelf Client is deliberately excluded from Roster queries.

```sql
-- Roster query (excludes isSelf)
SELECT * FROM clients WHERE trainer_id = $1 AND is_self = false

-- Athlete query (the isSelf client for My Training)
SELECT * FROM clients WHERE trainer_id = $1 AND is_self = true LIMIT 1
```

`ClientProfilePage` uses Roster vocabulary. `AthleteProfilePage` uses Athlete vocabulary. They share the same underlying data (via `clientId`) but must never be the same component.

### Integration (inbound / outbound)

| Direction | Context | Pattern | Description |
|-----------|---------|---------|-------------|
| Inbound | Training | PL | `SessionCompleted` → recalculate `isAtRisk` for client |
| Inbound | Identity | CS | `trainerId` gates all Roster queries |
| Outbound | Insight | CS | Client list + at-risk data consumed by report generation |
| Outbound | PWA | PL | `AtRiskThresholdCrossed` → push to Trainer *(🔜)* |

### Implementation

| Layer | Location |
|-------|----------|
| Schema | `src/db/schema/trainers.ts` (clients table), `src/db/schema/challenges.ts` |
| Routes | `src/routes/clients.ts`, `src/routes/challenges.ts` |
| Frontend page | `src/pages/ClientsPage.tsx`, `src/pages/ClientProfilePage.tsx` |
| Frontend component | `ClientProfilePanel` in `AppShell` |

---

---

## 6. Insight

### Responsibility

Aggregates data from Training, Athlete, and Roster to produce human-readable outputs: monthly reports and KPI trend data. Trainer-only. A supporting subdomain — valuable but downstream of everything else.

### Aggregates and key fields

| Aggregate | Table(s) | Key fields |
|-----------|----------|-----------|
| MonthlyReport | (future: `monthly_reports` table — not yet created) | `clientId`, `trainerId`, `period`, `htmlBody`, `sentAt` |
| KPI | (computed projection) | `clientId`, `streak`, `weeklyVolume`, `1rmEstimates`, `consistencyScore` |

### Ubiquitous language (Insight context)

| Term | Meaning here |
|------|-------------|
| **Monthly report** | An HTML email summarising a client's training month: goal arc, key metrics, trend commentary, session timeline |
| **Goal arc** | The narrative of goals set, in-progress, and achieved — drawn from Athlete context |
| **Trend commentary** | Human-readable interpretation of volume and performance changes (currently manual; AI-generated is explicitly cut from scope) |
| **KPI** | A computed metric: streak, weekly volume, estimated 1RM, consistency score |
| **Consistency score** | Sessions completed vs weekly target — derived from `weeklySessionTarget` preference |
| **Report period** | The calendar month the report covers |
| **Auto-report** | `autoReportEnabled = true` on the Trainer record — report sends automatically at month end |

### What Insight owns

- Monthly report generation logic
- Report dispatch (HTML email via external provider)
- KPI computation triggers (though KPIs are stored as projections on the Client/Trainer record)

### What Insight borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| Session data | Training | Reads sessions and sets for volume trend |
| Goal arc | Athlete | Reads `client_goals` for narrative |
| Snapshot deltas | Athlete | Reads `client_snapshots` for body comp trend |
| Client list | Roster | Reads clients for report addressing |
| `autoReportEnabled`, `timezone` | Identity | Trainer preferences gate report scheduling |

### External systems

| System | Direction | Description |
|--------|-----------|-------------|
| **Email provider** (SendGrid / Resend) | Outbound | HTML report email delivered to client's email address |
| **Delivery webhook** *(🔜)* | Inbound | Delivery/bounce/open events fed back for `ReportSentConfirmed` |

### Integration (inbound / outbound)

| Direction | Context | Pattern | Description |
|-----------|---------|---------|-------------|
| Inbound | Training | PL | `SessionCompleted` → recompute KPI trend |
| Inbound | Athlete | CF | Goal arc and snapshot data read directly |
| Inbound | Roster | CS | Client list read for report generation |
| Inbound | Identity | CS | `trainerId`, `autoReportEnabled`, `timezone` |
| Outbound | PWA | PL | `MonthlyReportSent` → push confirmation to Trainer *(🔜)* |

### Implementation

| Layer | Location |
|-------|----------|
| Routes | `src/routes/reports.ts` (monthly report send) |
| Schema | (future: `monthly_reports` table; KPIs computed in-flight) |
| External | Transactional email provider (not yet wired for delivery webhooks) |

---

---

## 7. PWA

### Responsibility

Makes the web app feel and behave like a native app. Manages the install lifecycle, service worker, offline cache strategy, and push notification subscription. A generic subdomain — important but following commodity patterns (Workbox / Web Push spec).

### Aggregates and key fields

| Aggregate | Store / Table | Key fields |
|-----------|--------------|-----------|
| InstallState | `localStorage` flag | `installPromptSeen` (boolean) |
| PushSubscription | (future: `push_subscriptions` table) | `trainerId`, `endpoint`, `p256dh`, `auth` |
| ServiceWorker | Browser runtime | Workbox precache + runtime cache strategies |

### Ubiquitous language (PWA context)

| Term | Meaning here |
|------|-------------|
| **beforeinstallprompt** | The browser event that signals the app is installable; must be captured and deferred immediately |
| **Passive install icon** | An always-visible icon in the nav header (Chrome/Edge/Android only) — tap to trigger install at any time |
| **Contextual prompt** | The one-time native install banner, fired after the first `SessionCompleted` event |
| **installPromptSeen** | A localStorage flag set to `true` after the prompt is shown (accepted or dismissed) — prevents re-prompting |
| **Share-sheet explainer** | The iOS-specific instruction card shown instead of the native prompt (iOS does not support `beforeinstallprompt`) |
| **Standalone mode** | The `display-mode: standalone` CSS media feature — true when launched from home screen icon |
| **VAPID** | Voluntary Application Server Identification — the key pair used to authenticate push messages |
| **Push subscription** | The endpoint + keys object created after the user grants push permission |
| **Background sync** | Service worker feature for replaying queued requests when connectivity restores (future — currently Sync handles this in-page) |

### What PWA owns

- Service worker registration and lifecycle (via vite-plugin-pwa + Workbox)
- `beforeinstallprompt` event capture and deferral
- Install prompt display logic (`installPromptSeen` flag)
- Passive install icon in nav header
- iOS share-sheet explainer card
- Push subscription creation and storage *(🔜)*
- Push notification delivery (via external gateway) *(🔜)*

### What PWA borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| `SessionCompleted` | Training | PL — event triggers the contextual install prompt |
| `AtRiskThresholdCrossed` | Roster | PL — event triggers push to Trainer *(🔜)* |
| `MonthlyReportSent` | Insight | PL — event triggers push confirmation *(🔜)* |
| `trainerId` | Identity | CS — push subscriptions are scoped to a Trainer |

### External systems

| System | Direction | Description |
|--------|-----------|-------------|
| **Push gateway** (VAPID / Web Push) *(🔜)* | Outbound | Server sends signed push message; browser OS surfaces it |
| **Cloudinary** | Outbound | Progress photo upload and CDN hosting; used by Athlete context |

### Implementation

| Layer | Location |
|-------|----------|
| Config | `vite.config.ts` (vite-plugin-pwa), `public/manifest.json` |
| Service worker | Generated by Workbox from vite-plugin-pwa config |
| Install logic | (🔜 not yet built — `installPromptSeen` flag + `beforeinstallprompt` handler) |
| Push backend | (🔜 future: `src/routes/push.ts`, `push_subscriptions` table) |

---

---

## 8. Billing

### Responsibility

Manages the subscription lifecycle, Stripe integration, and feature gating. The only context that communicates with Stripe. Determines which features each Trainer can access by writing `subscriptionTier` and `subscriptionStatus` to the `trainers` row — Identity reads these for route and feature guards. A supporting subdomain: important at SaaS launch, but not differentiating.

**Athlete accounts are entirely outside this context** — Athlete features are unconditionally free. This context only activates for `trainerMode = 'trainer'` users (though a Stripe Customer is created for all users at registration to allow future upgrade).

### Aggregates and key fields

| Aggregate | Table | Key fields |
|-----------|-------|-----------|
| Subscription | `trainers` (billing columns) | `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionTier` ('free' \| 'pro' \| 'studio'), `subscriptionStatus` ('trialing' \| 'active' \| 'pastDue' \| 'cancelled'), `trialEndsAt`, `currentPeriodEnd` |

*Note: billing fields live on the `trainers` row rather than a separate table — acceptable at current scale. A `subscriptions` table becomes appropriate when multi-seat or team billing is needed.*

### Ubiquitous language (Billing context)

| Term | Meaning here |
|------|-------------|
| **Trial** | A 14-day period of full Pro access that starts when `trainerMode = 'trainer'` is selected at onboarding. No payment method required. One-time per account. |
| **Billing gate** | The UI interceptor that blocks gated actions (e.g. Add Client) for free/pastDue trainers and presents the upgrade flow. The action is held and resumes automatically if subscription completes. |
| **Gated action** | Any mutation that requires a Pro or Studio subscription: AddClient, and any operation scoped to external clients beyond the isSelf client. |
| **Plan** | The subscription tier being offered: Free, Pro, Studio. Maps to `subscriptionTier`. |
| **Stripe Customer** | The Stripe-side representation of a Trainer. Created transparently at registration. Identified by `stripeCustomerId`. |
| **Stripe Checkout** | The Stripe-hosted payment page. Handles card entry and PCI compliance entirely. Returns a `checkout.session.completed` webhook on success. |
| **Invoice** | A Stripe billing record. Created automatically each billing cycle. Visible in the Stripe Customer Portal and the `/settings/billing` page. |
| **Grace period** | The short window after a `PaymentFailed` event before `SubscriptionDowngradedToFree` fires. Billing gate activates during grace period. |
| **currentPeriodEnd** | The timestamp when the current subscription period ends. Access continues until this date even after cancellation. |

### What Billing owns

- Stripe Customer creation (triggered by TrainerRegistered)
- Trial lifecycle: start, `trialEndsAt` tracking, expiry
- Stripe Checkout session creation and webhook handling
- `subscriptionTier`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`, `currentPeriodEnd` columns on `trainers`
- Billing gate logic: which features are gated at which tier
- `/settings/billing` route (plan view, upgrade, cancel, payment method update)

### What Billing borrows

| Borrowed concept | From context | How |
|-----------------|-------------|-----|
| `trainerId` | Identity | All Stripe Customers are scoped to a `trainerId` |
| `trainerMode` | Identity | Only `'trainer'` users trigger trial and billing gate |

### Integration (inbound / outbound)

| Direction | Context | Pattern | Description |
|-----------|---------|---------|-------------|
| Inbound | Identity | PL | `TrainerRegistered` → create Stripe Customer |
| Inbound | Identity | PL | `OnboardingCompleted (trainerMode='trainer')` → start trial |
| Outbound | Identity | CS | Writes `subscriptionTier` + `subscriptionStatus` to `trainers` row; Identity reads these for gating |

### External systems

| System | Direction | Description |
|--------|-----------|-------------|
| **Stripe** (Checkout, Billing, Customer Portal, Webhooks) | Bidirectional | Checkout: payment collection. Webhooks: payment events in. Customer Portal: self-serve billing management. |
| **Transactional email** (shared with Insight) | Outbound | Trial ended, payment failed, subscription confirmed emails |

### Implementation (target state — not yet built)

| Layer | Location |
|-------|----------|
| Schema | `trainers` table — add billing columns (migration needed; see G17) |
| Routes | `src/routes/billing.ts` — Stripe Checkout session, webhook handler, portal redirect |
| Frontend page | `src/pages/BillingPage.tsx` at `/settings/billing` |
| Frontend component | `BillingGate` — wraps gated actions; reads `subscriptionTier` + `subscriptionStatus` |
| Stripe config | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID` in `.env` |

---

---

## Language map — same word, different contexts

Words that carry different meaning depending on which context is active. These are the most dangerous ambiguities in the codebase.

| Word | Identity | Training | Athlete | Roster |
|------|----------|----------|---------|--------|
| **Client** | A `trainers` row's relation target (any) | The person a session is logged for (`clientId` FK) | "You" — the training subject, your profile | An external person being coached; never self |
| **Profile** | The Trainer's account/preferences | Not used | Your personal training home (`/my-training`) | A client's managed record (goals, sessions, history) |
| **Mode** | `trainerMode` on the Trainer record | The workout type (resistance, cardio, etc.) | Not used | Not used |
| **Goal** | Not used | Not used (Training has targets, not goals) | A personal intent with a target date | A client's training objective managed by the Trainer |
| **History** | Not used | `SessionHistoryPage` — per-session set breakdown | Your past sessions on your profile | Client's session timeline |
| **My Training** | Not used | Not used | The nav tab and primary profile view | "Trainer's isSelf training" — accessed via the same Athlete UI |
| **Summary** | Not used | `SessionSummaryPage` — post-session subjective scores | Not used | Monthly report summary |

---

---

## Context integration summary

| From → To | Pattern | Mechanism | Event / Data |
|-----------|---------|-----------|-------------|
| Identity → Training | CS | `request.trainer` on every request | `{ id, trainerMode }` |
| Identity → Athlete | CS | `clientId` from `GET /clients/self` | isSelf client scoping |
| Identity → Roster | CS | `trainerId` gates all queries | `WHERE trainer_id = $trainerId` |
| Identity → Insight | CS | Trainer preferences | `autoReportEnabled`, `timezone` |
| Identity → PWA | CS | `trainerId` scopes push subscriptions | `POST /push/subscribe` *(🔜)* |
| Training → Athlete | PL | Domain event | `SessionCompleted` → KPI recompute |
| Training → Roster | PL | Domain event | `SessionCompleted` → at-risk check |
| Training → Insight | PL | Domain event | `SessionCompleted` → KPI trend |
| Training → PWA | PL | Domain event | `SessionCompleted` → install prompt |
| Training ↔ Sync | SK | `offlineAwareApi` wraps Training writes | `{ method, path, body }` queue items |
| Sync → All | PL | DOM event | `trainer-app:sync-complete` |
| Athlete → Insight | CF | Direct read | `client_goals`, `client_snapshots` |
| Roster → Insight | CS | Direct read | `clients` list for report |
| Roster → PWA | PL | Domain event | `AtRiskThresholdCrossed` *(🔜)* |
| Insight → PWA | PL | Domain event | `MonthlyReportSent` *(🔜)* |
| Identity → Billing | PL | Domain event | `TrainerRegistered` → Stripe Customer creation |
| Billing → Identity | CS | Direct write | `subscriptionTier` / `subscriptionStatus` written to `trainers` row |
| Billing ↔ Stripe | ACL | Webhooks + API | Stripe is upstream; Billing translates Stripe events into domain events |

---

---

## Decision record

| Decision | Rationale |
|----------|-----------|
| **Client as shared kernel (not separate per-context)** | The `clients` table is physically one table. Creating separate physical representations for Athlete and Roster would require synchronisation. The shared kernel with ACL at the frontend is the right trade-off at this scale. |
| **isSelf flag as the only discriminator** | The backend is deliberately `isSelf`-agnostic — all operations work the same way. Only the frontend applies vocabulary and navigation differences. This keeps the API simple and avoids branching server-side logic. |
| **Athlete ACL is frontend-only** | The backend doesn't enforce the Athlete/Roster language boundary — it serves `clientId`-scoped data uniformly. The ACL is enforced by route guards, dedicated components, and vocabulary in the UI layer. |
| **Sync as a supporting subdomain, not infrastructure** | Sync has its own bounded context because the offline/online queue has its own language (`QueueItem`, `flush`, `replay order`) that is distinct from both Training (which doesn't know about offline) and the platform (which doesn't know about our queue schema). |
| **PWA as a separate generic subdomain** | Install lifecycle and push notifications follow Web platform specs, not business rules. Keeping this separate avoids polluting Training or Identity with browser-API concerns. |
| **Insight reads directly from Athlete and Training tables** | At the current scale, report generation reads across tables via JOIN. A strict published-language integration (materialised projection, event-sourced report store) would be premature. The CF pattern is correct for now; revisit if reports need to scale independently. |
