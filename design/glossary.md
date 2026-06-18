# Glossary — TrainerApp

**Phase 0 artifact — canonical reference**
**Last updated:** 2026-06-17

---

## How to use this glossary

This is the single source of truth for terminology across the codebase, design documents, and team conversations. When a term appears in a PR, a schema column name, or a component prop, its meaning here is authoritative.

**Context labels** indicate which bounded context owns the term:

| Label | Context |
|-------|---------|
| `[ID]` | Identity |
| `[TR]` | Training |
| `[AT]` | Athlete |
| `[RO]` | Roster |
| `[SY]` | Sync |
| `[IN]` | Insight |
| `[PW]` | PWA |
| `[ALL]` | Cross-cutting |

Terms marked ⚠️ appear in multiple contexts with **different meanings** — see the Dangerous Overlaps section first.

---

## Dangerous overlaps

These words change meaning depending on which context is active. Misuse is the primary source of bugs and miscommunication.

| Term | In Identity / System | In Training | In Athlete | In Roster |
|------|---------------------|-------------|------------|-----------|
| **Client** | Any `clients` row (including isSelf) | The athlete or client the session is logged for (`clientId` FK) | Not used — the athlete is always referred to as "you" or "your" in the Athlete UI | An external person being coached; never isSelf; shown in the roster |
| **Profile** | The Trainer's account and preferences | Not used | Your personal training home at `/my-training` | A managed client's full record (goals, sessions, history) |
| **Goal** | Not used | Not used (Training has *targets*, not goals) | A training objective belonging to an athlete | A training objective of a client, managed by the Trainer |
| **History** | Not used | Short for session history — the record of past sessions | Your past sessions, accessible from your profile | A client's record of past sessions |
| **Summary** | Not used | `SessionSummaryPage` — post-session subjective scores screen | Not used | A concise view of a monthly report |
| **Self** | isSelf — the flag that marks the Trainer's own training record | Not used | The Athlete IS the self — no concept of "self" needed | The Trainer's own training, accessed through "My Training"; the isSelf record is never shown in the roster |

---

---

## A

### Access token `[ID]`
A short-lived JWT (15-minute TTL) issued on login or token refresh. Lives in Zustand memory only — never written to `localStorage` or a cookie. Sent as a Bearer token on every authenticated API request. XSS cannot steal it because it is never persisted to disk.

### Active session `[TR]`
A session in `in_progress` status. Keyed by `clientId` in the `activeSessions` store — only one active session is allowed per client at a time. Displayed as a full-screen overlay (the Spotify model). Can be minimised to a persistent pill without losing state.

### Athlete `[ALL]`
A registered user with `trainerMode = 'athlete'`. Uses the app for personal training only: plan routines, log sessions, track progress. Has no client roster, no monthly reports, no at-risk monitoring. The app's core user type — the Trainer experience is built on top of it, not the other way around. See also: *Trainer*, *trainerMode*.

### AthleteProfilePage `[AT]`
A dedicated frontend component that renders a training subject's personal profile: KPI hero, goals, snapshot history, session timeline. Renders at `/my-training`. **Not the same component as `ClientProfilePage`** — they serve different audiences and use different vocabulary. Both Athlete users and Trainers (via "My Training") see this component; it is always scoped to an `isSelf = true` client for the Trainer path.

### At-risk `[RO]`
A client who has not completed a session in 14 or more days. Flagged with an amber indicator in the roster list and dashboard at-risk widget. The threshold is 14 days; the `isAtRisk` boolean is stored on the `clients` row and recomputed after every `SessionCompleted` event.

### At-risk threshold `[RO]`
The number of days without a completed session before a client is considered at-risk. Currently fixed at **14 days**.

### Auto-report `[IN]`
When `autoReportEnabled = true` on the Trainer's record, monthly reports are generated and sent automatically at the end of each calendar month without a manual trigger. Can be overridden per-client (future). Default: `true`.

---

## B

### Billing gate `[ALL]`
The UI component that intercepts gated actions for trainers on the `free` tier or with `subscriptionStatus = 'pastDue'`. When triggered, it renders an upgrade modal explaining which feature is blocked and offering a path to subscribe. The blocked action is held — if the trainer completes a subscription in the same session, the action resumes automatically without re-triggering it. Athletes never encounter the billing gate.

**Gated actions (Pro required):** AddClient, and any mutation scoped to external (non-isSelf) clients.

### Background sync `[PW]`
A Web platform feature that allows a service worker to replay queued requests after connectivity is restored, even if the page is closed. Currently deferred — the app's offline sync runs in-page via `syncService.flushQueue()`. Background sync (service-worker-level) is a future enhancement.

### Baseline `[AT]`
The earliest snapshot on record for a training subject. All subsequent snapshots show a delta relative to the baseline. The baseline snapshot itself has no delta.

### beforeinstallprompt `[PW]`
A browser event fired by Chrome, Edge, and Android Chrome when the app meets the PWA installability criteria. Must be captured and deferred immediately — calling `.preventDefault()` stops the native banner from appearing automatically. The captured event is stored for later use by the passive install icon and contextual prompt. iOS Safari does not fire this event.

### Block type
See *Workout*.

### Body part `[TR]`
The primary muscle group an exercise targets. Used to filter the exercise library.

Values: `arms` · `back` · `chest` · `legs` · `shoulders` · `core` · `full_body`

---

## C

### Challenge `[RO]`
A Trainer-assigned performance target for a client. Has a metric type (e.g. `weight_lifted`, `sessions_completed`), a target value, and a tracked progress value. Athletes see their active challenges on the dashboard. Status lifecycle: `active → completed | expired | cancelled`.

**Challenge metric types:** `weight_lifted` · `reps_achieved` · `distance` · `duration` · `sessions_completed` · `qualitative`

### Client ⚠️ `[RO]` / `[DB]`
**In Roster context:** An external person being coached by a Trainer. Always `isSelf = false`. Appears in the roster. Has goals, snapshots, sessions, and challenges managed by the Trainer. The word "client" is Roster vocabulary only — it is never surfaced in the Athlete UI.

**In the database:** Any row in the `clients` table, including `isSelf = true` rows. The schema uses "client" uniformly; only the UI applies the vocabulary split.

**In Athlete context:** The term "client" does not appear. The athlete is referred to as "you" / "your." The underlying `clients` row is there, but the context speaks about the athlete directly.

See also: *isSelf*, *Athlete*, *Shared kernel (Client)* in `bounded-contexts.md`.

### Client focus `[RO]` / `[AT]`
The training discipline a client is primarily working on. Drives which KPIs are surfaced in the dashboard and monthly report.

Values: `cardio` · `resistance` · `calisthenics` · `mixed`

### ClientProfilePage `[RO]`
The Trainer's view of an external client's record: KPI hero, goal list, snapshot history, session timeline, challenges. Accessible at `/clients/:id`. **Not the same as `AthleteProfilePage`** — uses Roster vocabulary ("Client goals", "Client measurements"). Athletes never see this component; it is route-guarded.

### Comparison `[AT]`
The side-by-side slider view of two snapshots' progress photos. Implemented via `PhotoComparisonSlider`. User selects two snapshots from the `ProgressPhotoTimeline`; the slider reveals both simultaneously.

### Compound exercise `[TR]`
A multi-joint movement (e.g. squat, bench press, row). Stored as `ExerciseCategory = 'compound'`. See also: *Isolation exercise*.

### Concurrent sessions `[TR]`
The ability to have multiple sessions open simultaneously. `plannedSessions` is a map keyed by `sessionId` — any number of planned sessions can be open at once for any combination of clients. `activeSessions` is keyed by `clientId` — one `in_progress` session per client at a time.

### Consistency score `[AT]` / `[IN]`
A computed KPI: sessions completed in the last 28 days divided by the weekly session target × 4. Shown in the KPI hero and used in monthly report narrative. Expressed as a percentage. Driven by `weeklySessionTarget` preference.

### currentPeriodEnd `[Billing]`
The timestamp when the current subscription billing period ends. Stored on the `trainers` row. A trainer who cancels their subscription retains Pro access until this date — access does not cut off immediately. After `currentPeriodEnd`, `SubscriptionDowngradedToFree` fires and the billing gate activates.

### Contextual install prompt `[PW]`
The one-time native install banner shown after a user's first completed session. Fires only if `beforeinstallprompt` has been captured and `installPromptSeen` is `false`. After it fires (accepted or dismissed), `installPromptSeen` is set to `true` and the prompt is never shown again. See also: *Passive install icon*.

### CTA label `[TR]`
The Trainer-customisable text on the "Start Training" button. Stored as `ctaLabel` on the `trainers` row. Default: `'Start Training'`. Examples: "Let's Go", "Train Now", "Begin".

---

## D

### Delta `[AT]`
The change in a measurement field between a snapshot and the one immediately prior to it. Shown on the snapshot detail view and the profile baseline tab. Positive delta = increase; negative delta = decrease. No delta is shown on the first (baseline) snapshot.

### Device `[ID]`
A browser instance identified by a stable UUID stored in `localStorage` under the key `trainer_device_id`. Used to scope refresh tokens — a logout on one device does not invalidate other devices' sessions. The UUID is not sensitive; it carries no access on its own.

### Device ID `[ID]`
The UUID identifying this browser/device. Sent as the `X-Device-ID` request header on all authenticated requests. Written to `sync_log.deviceId` for conflict detection. Stored in `localStorage` (intentionally — unlike access tokens, this is not sensitive).

---

## E

### Epley formula `[TR]`
The formula used to estimate one-rep max from a logged set: `1RM = weight × (1 + reps / 30)`. Used to compute `is1rmEstimatePR` on a set. Named after Boyd Epley. See also: *Personal Record (PR)*, *1RM estimate*.

### Equipment `[TR]`
The equipment category required for an exercise. Used as metadata on the exercise record; not currently used to filter sessions.

Values: `none` · `bodyweight` · `barbell` · `dumbbell` · `cable` · `machine` · `kettlebell` · `resistance_band` · `cardio_machine` · `other`

### Exercise `[TR]`
A named movement in the exercise library. Has a name, body part, workout type, equipment, category (compound/isolation), difficulty, and optional media (muscle diagram, demo video). Custom exercises are scoped to a `trainerId`; library exercises have no `trainerId`.

### Exercise library `[TR]`
The full catalogue of exercises (109 seeded at init). Prefetched by `syncService` on app load and cached for offline use. Filterable by workout type, body part, equipment. Custom exercises are appended and scoped to the Trainer's account.

---

## F

### Flush `[SY]`
The process of replaying all queued operations from the `offlineQueue` to the server after connectivity is restored. Triggered by the `window online` event. Processes items in dependency order: session → workouts → sessionExercises → sets. Each successful replay writes a `sync_log` entry and removes the item from the queue. See also: *Replay order*.

---

## G

### Grace period `[Billing]`
The short window after a `PaymentFailed` event during which a trainer's account enters `pastDue` status but is not yet downgraded to `free`. The billing gate activates immediately, but existing Pro features remain readable. If payment is recovered within the grace period, access is fully restored. After the grace period expires, `SubscriptionDowngradedToFree` fires.

### Goal `[AT]` / `[RO]`
A training objective belonging to an athlete or client. Has a title, optional target date, and an achievement marker. Goals are append-only — marking a goal achieved sets `achievedAt` but does not delete the record. Deletion soft-deletes (the record persists for monthly report narrative). See also: *Goal arc*.

### Goal arc `[AT]` / `[IN]`
The full chronological history of all goals for a training subject — set, in-progress, and achieved. Never truncated. Used as the narrative backbone of monthly reports: "At the start of the month, [client] wanted to X. They achieved Y."

---

## I

### Invoice `[Billing]`
A Stripe billing record generated automatically each subscription cycle. Contains the amount, billing date, and payment status. Not stored in the TrainerApp database — fetched from the Stripe API and displayed in `/settings/billing`. Also created when a subscription is first created or a plan is changed (with proration).

### In-session history `[TR]`
The last three sets for a given client on a given exercise, shown inline during set logging. Surfaces: date, weight, reps, and whether a PR was set. Enables informed load selection without leaving the live session view.

### installPromptSeen `[PW]`
A `localStorage` flag set to `true` after the contextual install prompt has been shown (regardless of whether the user accepted or dismissed). Prevents the prompt from ever appearing again. The passive install icon remains available in the nav header regardless of this flag.

### Intensity `[TR]`
An optional subjective rating for a cardio set or session block.

Values: `low` · `moderate` · `high` · `max`

### Isolation exercise `[TR]`
A single-joint movement (e.g. bicep curl, leg extension). Stored as `ExerciseCategory = 'isolation'`. See also: *Compound exercise*.

### isSelf `[ALL]`
A boolean flag on the `clients` row that marks the Trainer's own training record. `true` = this record is the Trainer training themselves, not an external client. Auto-created at registration. **Never shown in the client roster** — all roster queries filter with `WHERE is_self = false`. Accessible only via the "My Training" tab.

The backend treats isSelf and non-isSelf records identically — all operations (sessions, goals, snapshots) work the same way regardless of this flag. The frontend applies all vocabulary and navigation differences.

- Roster: excluded entirely (`WHERE is_self = false`)
- Athlete user: the isSelf record is the only record they ever access — it is their training
- Trainer user: accessed via "My Training"; renders `AthleteProfilePage` scoped to this record

---

## K

### KPI `[AT]` / `[IN]`
Key Performance Indicator — a computed metric displayed in the KPI hero on the dashboard and profile. Current KPIs: streak, weekly volume, 1RM estimates per exercise, consistency score. Which KPIs are surfaced depends on `clientFocus`.

### KPI hero `[AT]`
The summary bar at the top of a training profile showing the most important computed metrics at a glance. Displays differently for Athlete vs Trainer context: `isAthlete = true` hides Trainer-specific tips and shows the Athlete-centric summary.

---

## M

### Mode ⚠️ `[ID]` / `[TR]`
**In Identity context:** `trainerMode` — whether a user is an `athlete` or a `trainer`. Set once at onboarding. Gates navigation, route access, and feature visibility across the entire app.

**In Training context:** The workout block type for a session (e.g., resistance mode, cardio mode). Entirely separate concept from identity mode.

### Monthly report `[IN]`
An HTML email sent to a client summarising their training month. Sections: goal arc, key metrics (volume trend, 1RM deltas, consistency), trend commentary, session timeline. Generated on demand or automatically (`autoReportEnabled`). Dispatched via the transactional email provider. See also: *Auto-report*.

### My Training `[AT]`
The nav tab and route (`/my-training`) that takes a user to their personal training profile (`AthleteProfilePage`). Used by Athlete users as their primary profile entry point. Used by Trainers to access their own isSelf Athlete experience. In both cases, renders `AthleteProfilePage` scoped to the relevant isSelf client. Must render directly — not redirect to `/clients/:id`.

---

## O

### Offline queue `[SY]`
The IndexedDB store (`offlineQueue`) that holds write operations that failed to reach the server because the device was offline. Each item: `{ method, path, body, description, enqueuedAt, retryCount }`. Items survive app restarts and are replayed on reconnect. See also: *Flush*, *Replay order*.

### OfflineBanner `[SY]`
The UI component that surfaces sync state to the user. State machine: `hidden` → `offline+no-pending` → `offline+pending(N writes queued)` → `syncing` → `error (tap to retry)` → `hidden`. Never intrusive — appears only when the state is actionable.

### OnboardingGate `[ID]`
A React component that wraps all protected routes. If `trainer.onboardedAt` is `null`, redirects immediately to `/onboard` regardless of which route was requested. Ensures mode selection cannot be skipped.

### 1RM estimate `[TR]`
The estimated one-rep maximum for a given exercise, computed using the Epley formula from the heaviest set logged. Stored and tracked per client per exercise. Used for PR detection and KPI display. `show1rmEstimate` preference gates whether it is displayed to the user.

---

## P

### Passive install icon `[PW]`
An icon permanently visible in the nav header area for browsers that support `beforeinstallprompt`. Tapping it triggers the native install prompt (or iOS explainer card) at any time. Always present — not hidden after the contextual prompt has been shown. Gives motivated users a reliable install path without forcing it on uninterested users.

### Personal Record (PR) `[TR]`
A new best performance for a given client on a given exercise. Two types are tracked independently:

- **1RM PR** (`isPR = true`): a new Epley 1RM estimate best
- **Volume PR** (`isPRVolume = true`): a new weight × reps best

Which type triggers the in-session PR flash is controlled by `prNotifyType` (values: `1rm` · `volume` · `both`). Both flags are stored on the `sets` row.

### Photo sharing preference `[AT]`
Controls which progress photos are eligible for social sharing. Stored as `photoSharingPreference` on the `trainers` row.

Values: `private` (default) · `share_selected` · `share_all`

### Plan `[Billing]`
The subscription tier a trainer is subscribing to. Three plans: **Free** (self-training only; always free), **Pro** (client management up to N clients; monthly/annual), **Studio** (unlimited clients + team features; monthly/annual). Maps to `subscriptionTier`. "Plan" is Billing vocabulary — in Identity, the same concept is `subscriptionTier`.

### Planned session `[TR]`
A session with status `planned`. Has no `startTime`. Can have workout blocks and exercises pre-populated (from a template or manually). Multiple planned sessions can exist simultaneously (map keyed by `sessionId`). Transitions to `in_progress` when the user taps "Start". See also: *Active session*, *Concurrent sessions*.

### Pose `[AT]`
The angle from which a progress photo is taken. Standardised for consistent comparison across time.

Values: `front` · `side_left` · `side_right` · `back` · `custom`

### PR flash `[TR]`
The amber pulse animation that fills the set-logging area when a Personal Record is detected. Lasts approximately 2 seconds then fades. Fires simultaneously with the rest timer. A deliberate "wow" moment — the only unsolicited animation in the training flow. Controlled by `prNotifyType` preference.

### Progression state `[RO]`
Where a client is in their journey with the Trainer. Stored on the `clients` row.

Values:
- `assessment` — gathering baseline, learning capability and goals
- `programming` — plan committed, actively working a program
- `maintenance` — goals achieved, sustaining performance

### Push subscription `[PW]`
The endpoint and key pair created after the user grants push notification permission. Stored server-side (future: `push_subscriptions` table). Scoped to a `trainerId`. Used to deliver at-risk alerts and report confirmation pushes. Not yet implemented.

---

## Q

### Queue item `[SY]`
A single pending write operation in the `offlineQueue`. Fields: `method` (POST/PATCH/DELETE), `path` (the API endpoint), `body` (the request payload), `description` (human-readable for OfflineBanner display), `enqueuedAt`, `retryCount`. Items are versioned to the API surface of Training routes — endpoint renames require queue migration.

---

## R

### Refresh token `[ID]`
A 7-day token stored exclusively in an httpOnly cookie. Never readable by JavaScript. Used to obtain a new access token when the current one expires. Scoped to a `deviceId`. A tab refresh triggers a silent `POST /auth/refresh` before any authenticated request fires.

### Replay order `[SY]`
The required sequence for flushing an offline session chain: **session → workouts → sessionExercises → sets**. Parent records must exist before child records are posted. Violating this order causes 404 foreign key failures. The offline queue must preserve enqueueing order and the flush must process serially within a chain.

### Rest timer `[TR]`
A countdown timer that starts automatically after a set is logged. Duration set by `restDurationSeconds` preference (default: 90 seconds). Displayed in the session footer and persists across panel navigations within the live session view. Fires simultaneously with a PR flash when a PR is detected.

### Roster `[RO]`
The list of all external clients managed by a Trainer. Excludes the isSelf client. Displayed at `/clients`. Ordered by last session date. At-risk clients are highlighted in amber.

---

## S

### Self-client
See *isSelf*.

### Session `[TR]`
A bounded training event with a defined lifecycle. A session is the collection of all its workouts. Each workout contains exercises; each exercise contains logged sets.

**Status values:**
- `planned` — created, not yet started; no `startTime`
- `in_progress` — actively being executed; `startTime` set
- `completed` — finished; `endTime` and subjective scores recorded
- `partial` — cut short; saved via dismiss sheet when ≥1 sets were logged; marked "cut short" in session history; no subjective scores captured
- `cancelled` — abandoned via the dismiss sheet Discard action (0 sets, or user chose Discard over partial save); sets are preserved; terminal state

### Session overlay `[TR]`
The full-screen UI surface for an `in_progress` session. Uses the Spotify model: occupies the full viewport, can be minimised to a persistent pill at the bottom of the screen without ending the session. Minimising preserves all state.

### Session pill `[TR]`
The minimised form of the session overlay — a persistent bar at the bottom of the screen showing the session's current status. Tapping it restores the full overlay. Multiple planned sessions show as a pill stack (cap to be defined).

### Session summary `[TR]`
The screen shown immediately after a session is completed. Captures subjective scores (energy, mobility, stress sliders) and RPE. The final step before the session record is committed as `completed`.

### Set `[TR]`
A single logged effort within a session exercise. For resistance exercises: `weight`, `reps`, optional `side`. For cardio: `distance`, `duration`, `intensity`. Stores `isPR`, `isPRVolume`, `is1rmEstimatePR` flags. `unit` (lbs/kg) is stored on the set — historical records remain accurate if the trainer later switches units.

### Share-sheet explainer `[PW]`
An in-app instruction card shown to iOS Safari users instead of the native install prompt (iOS does not support `beforeinstallprompt`). Shown on the same trigger as the contextual prompt. Instructs the user to tap the browser Share button and select "Add to Home Screen." Includes an illustration.

### Snapshot `[AT]`
A point-in-time measurement record for a training subject. Contains up to 34 optional measurement fields across five categories: body composition (weight, body fat %, etc.), circumference (arms, waist, hips, etc.), cardiovascular (resting HR, VO2 max, etc.), functional (vertical jump, push-up count, etc.), and subjective (energy, sleep, stress). All fields are optional — a snapshot with a single field is valid.

### Standalone mode `[PW]`
The browser display mode when the app is launched from a home screen icon. Detected via the `(display-mode: standalone)` CSS media query. In standalone mode: no browser address bar or navigation chrome; auth cookie persists across launches; the share-sheet explainer is unnecessary (app is already installed).

### Stripe Checkout `[Billing]`
The Stripe-hosted payment page used to collect payment details and create a subscription. Opens in the browser (redirect or popup). TrainerApp never handles raw card numbers — PCI compliance is fully delegated to Stripe. On success, Stripe sends a `checkout.session.completed` webhook; on failure, the user is redirected back to the upgrade flow.

### stripeCustomerId `[Billing]`
The Stripe-assigned identifier for a Trainer's Stripe Customer object. Stored on the `trainers` row. Created transparently at registration for all users (both Athlete and Trainer) so that an upgrade can always be initiated. Required for creating Checkout sessions and accessing the Customer Portal.

### Streak `[AT]`
The number of consecutive weeks in which at least one session was completed. A computed KPI. Breaks if a full calendar week passes with zero completed sessions.

### Subscription tier `[ID]` / `[Billing]`
The billing tier for a Trainer account. Stored as `subscriptionTier` on the `trainers` row. **Owned by Billing** — Billing writes it; Identity reads it for feature gating. `trainerMode` and `subscriptionTier` are **orthogonal** — no code should assume `athlete = free` or `trainer = paid`. Both fields are checked independently.

Values:
- `free` — self-training only (isSelf client only; external clients blocked by billing gate). Athletes are permanently free.
- `pro` — up to N external clients (N to be defined at SaaS launch)
- `studio` — unlimited clients, team features

**subscriptionStatus:** `trialing` · `active` · `pastDue` · `cancelled`

See also: *Plan*, *Trial*, *Billing gate*, *currentPeriodEnd*.

### Sync log `[SY]`
The server-side audit table (`sync_log`) of all write operations that successfully reached the server. Each entry: `trainerId`, `deviceId`, `tableName`, `recordId`, `operation` (insert/update/delete), `payload` (full record as JSON), `createdLocallyAt` (device time from `X-Local-Timestamp` header, or server time for online writes), `syncedAt` (always server time). Enables future conflict detection when the same record is written from two devices offline.

---

## T

### Target values `[TR]`
The intended weight and rep count for a session exercise, copied from a template or set manually during session planning. Stored as `targetWeight` and `targetReps` on `session_exercises` and `template_exercises`. Displayed during a live session as a guide. Actual logged sets are recorded separately and never overwrite targets.

### Template `[TR]`
A reusable structure: an ordered set of workouts, each with exercises and target values. Scoped to a `trainerId`. Applied to a session by copying the template's workouts and exercises into the session. Saving a session as a template copies the session's actual values into a new template record.

Two types, distinguished by `templates.type`:
- `'session'` — a classic multi-workout template; may span multiple workout types
- `'workout'` — a single-workout-type block (see *WorkoutTemplate*); all exercises share one workout type

See also: *WorkoutTemplate*.

### WorkoutTemplate `[TR]`
A `templates` row with `type = 'workout'`. A reusable single-workout-type block where every exercise must share one workout type (e.g., all resistance, all cardio). Built in the unified template builder with the type toggle set to "Workout". Can be applied directly to a single workout block within a session, or used standalone. Distinct from a session template, which may contain multiple workout types. See also: *Template*.

### Trainer `[ID]`
The system-level user record for any registered user — regardless of whether they coach others or only train themselves. The `trainers` table row. Holds identity, preferences, subscription, and mode fields. The word "Trainer" in code always refers to this record, not specifically to a user who coaches clients.

**Note:** As a product role, "Trainer" means a user with `trainerMode = 'trainer'`. As a schema entity, `Trainer` means any registered user. Context matters.

### Trainer role `[ID]`
The system access role for a Trainer account. Not the same as `trainerMode`.

Values: `trainer` (default) · `admin`

### trainerMode `[ID]`
The mode chosen at onboarding. Gates navigation, route access, and feature visibility across the entire app.

Values:
- `athlete` — personal training only; no client roster; `/clients` routes blocked; Athlete nav
- `trainer` — full feature set; client roster visible; Trainer nav

Set once at onboarding. Changing modes: `athlete → trainer` upgrade is a future deferred flow; `trainer → athlete` requires cancelling and starting fresh.

### Trial `[Billing]`
A 14-day period of full Pro access that starts automatically when a new user selects `trainerMode = 'trainer'` at onboarding. No payment method required. One-time per account — re-registering or re-selecting Trainer mode does not grant a second trial. Stored as `subscriptionStatus = 'trialing'` and `trialEndsAt` on the `trainers` row. At expiry without a subscription, `subscriptionTier` reverts to `free`.

### trialEndsAt `[Billing]`
The timestamp when the 14-day Pro trial expires. Stored on the `trainers` row. A background cron fires at this time: if no active Stripe subscription exists, `SubscriptionDowngradedToFree` is triggered. If a subscription was created before this date, `trialEndsAt` is superseded by `currentPeriodEnd`.

### trainer-app:sync-complete `[SY]`
A custom DOM event dispatched after a successful offline queue flush. Triggers TanStack Query cache invalidation across the app. Any component or hook that needs to react to a sync completion listens for this event.

---

## U

### UX event system `[ALL]`
A 33-type taxonomy of interaction animations (pulse on add, confetti on achievement, amber flash on PR, etc.). Drives the "alive" feel of the app. Separate from domain events — these are purely presentational.

---

## V

### VAPID `[PW]`
Voluntary Application Server Identification — the cryptographic key pair used to authenticate push messages from the server to the browser's push service. Required for the Web Push protocol. Not yet implemented.

### Volume PR `[TR]`
A new best `weight × reps` for a given client on a given exercise in a single set. Tracked independently from the 1RM PR. Stored as `isPRVolume = true` on the set. See also: *Personal Record (PR)*.

---

## W

### Weekly session target `[AT]` / `[IN]`
The number of sessions per week the trainer (or client) aims to complete. Stored as `weeklySessionTarget` on the `trainers` row (default: 3). Used to compute the consistency score. Also appears on client records for per-client goal tracking.

### Widget progression `[ID]`
The ordered list of dashboard widget IDs for a Trainer, stored as a comma-delimited text string in `trainers.widgetProgression`. Parsed by `parseWidgetProgression()` in JavaScript — never queried inside the database. Avoids a join table for a small, infrequently-changed ordered list.

### Workout `[TR]`
A named group of exercises within a session, organised by type. A session is the collection of all its workouts. Each exercise is contained in a workout; each workout contains one or more exercises, each with logged sets. The workout type determines which logging fields are shown and drives the default ordering within a session.

**Workout types:** `cardio` · `stretching` · `calisthenics` · `resistance` · `cooldown`

Default order within a session: cardio → stretching → calisthenics/resistance → cooldown.

Also referred to as "workout block" in older code — the canonical term is **workout**.

---

## X

### X-Device-ID `[SY]` / `[ID]`
A request header sent on every authenticated API call. Value is the device's UUID (from `localStorage`). Written to `sync_log.deviceId`. Used server-side to scope refresh tokens and identify the origin device of a write.

### X-Local-Timestamp `[SY]`
An optional request header carrying the device's local time when a write was made. Written to `sync_log.createdLocallyAt` when present. Allows the server to distinguish an online write (no header → `createdLocallyAt = syncedAt`) from an offline replay (header present → `createdLocallyAt < syncedAt`).

---

## Enum reference

Quick-reference table of all application enum values.

| Enum | Values |
|------|--------|
| `SessionStatus` | `planned` · `in_progress` · `completed` · `partial` · `cancelled` |
| `WorkoutType` (workout type) | `cardio` · `stretching` · `calisthenics` · `resistance` · `cooldown` |
| `BodyPart` | `arms` · `back` · `chest` · `legs` · `shoulders` · `core` · `full_body` |
| `Equipment` | `none` · `bodyweight` · `barbell` · `dumbbell` · `cable` · `machine` · `kettlebell` · `resistance_band` · `cardio_machine` · `other` |
| `ExerciseCategory` | `compound` · `isolation` |
| `Intensity` | `low` · `moderate` · `high` · `max` |
| `Difficulty` | `beginner` · `intermediate` · `advanced` |
| `Side` | `left` · `right` · `both` |
| `WeightUnit` | `lbs` · `kg` |
| `TrainerMode` | `athlete` · `trainer` |
| `TrainerRole` | `trainer` · `admin` |
| `SubscriptionTier` | `free` · `pro` · `studio` |
| `SubscriptionStatus` | `trialing` · `active` · `pastDue` · `cancelled` |
| `ClientFocus` | `cardio` · `resistance` · `calisthenics` · `mixed` |
| `ProgressionState` | `assessment` · `programming` · `maintenance` |
| `SnapshotPose` | `front` · `side_left` · `side_right` · `back` · `custom` |
| `PhotoSharingPreference` | `private` · `share_selected` · `share_all` |
| `SyncOperation` | `insert` · `update` · `delete` |
| `ChallengeMetricType` | `weight_lifted` · `reps_achieved` · `distance` · `duration` · `sessions_completed` · `qualitative` |
| `ChallengeStatus` | `active` · `completed` · `expired` · `cancelled` |
