# Task Flow — TrainerApp

**Phase 0 artifact — draft for review**
**Last updated:** 2026-06-18

Flows are system-level — they describe what the system must do, not how the UI presents it. UI detail lives in `user-flow.md`.

---

## Flows index

| ID | Flow | Persona | Context |
|---|---|---|---|
| TF-01 | Register and onboard | Both | Identity |
| TF-02 | Log a live session end-to-end | Both | Training |
| TF-03 | Log a set while offline | Both | Training / Sync |
| TF-04 | Plan a session in advance | Both | Training |
| TF-05 | Apply a template to a session | Both | Training |
| TF-06 | Browse exercises and add to session | Both | Training |
| TF-07 | View session history and per-exercise context | Both | Training |
| TF-08 | View training profile (goals, snapshots, history) | Both | Athlete / Roster |
| TF-09 | Set a goal and mark it achieved | Both | Athlete / Roster |
| TF-10 | Add an external client | Trainer only | Roster |
| TF-11 | Send a monthly report | Trainer only | Insight |
| TF-12 | Install the app to home screen | Both | PWA |
| TF-13 | Offline queue flush on reconnect | Both | Sync |
| TF-14 | Capture a snapshot (measurements + subjective scores) | Both | Athlete / Roster |
| TF-15 | Attach a progress photo to a snapshot | Both | Athlete / Roster |
| TF-16 | Build a template from scratch | Both | Training |

---

## TF-01: Register and onboard

**Trigger:** User opens the app for the first time and has no account.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Submits registration form (name, email, password) |
| 2 | System | Validates input (email format, password min length) |
| 3 | System | Hashes password with argon2id |
| 4 | System | Creates `Trainer` record |
| 5 | System | Creates `isSelf` Client record linked to the new Trainer |
| 6 | System | Issues JWT (15-min, in-memory) and refresh token (7-day, httpOnly cookie) |
| 7 | System | Redirects to `/onboard` |
| 8 | User | Selects mode: **Athlete** or **Trainer** |
| 9 | System | Sets `trainer.trainerMode`, records `onboardedAt` |
| 10a | System | **If Athlete:** routes to Athlete dashboard (`/`) with athlete nav |
| 10b | System | **If Trainer:** routes to Trainer dashboard (`/`) with trainer nav |

**End state:** Account exists, isSelf client exists, mode set, user on their dashboard.

**Failure paths:**
- Step 2 fails → form shows field-level validation errors; no record created
- Step 4/5 fails (DB error) → registration error shown; user can retry
- User closes app at step 7–8 (before onboarding) → `onboardedAt` is null; `OnboardingGate` catches every subsequent navigation and redirects to `/onboard`

**Obstacles:**
- ⚠️ If the user registers offline, steps 2–6 all fail (no network). Registration requires connectivity — there is no offline path. The app should surface a clear "you need internet to create an account" message rather than a generic error.

---

## TF-02: Log a live session end-to-end

**Trigger:** User decides to train now (not from a pre-planned session).

| Step | Actor | Action |
|---|---|---|
| 1 | User | Taps CTA ("Start Training" or equivalent) |
| 2 | System | Opens session launcher |
| 3a | System | **If Athlete:** auto-selects self-client; no picker shown |
| 3b | System | **If Trainer:** shows client picker (or "My Training" for self) |
| 4 | System | `POST /sessions` → status: `in_progress`; `startTime` recorded (jump-in: session created and started atomically) |
| 5 | User | Adds exercise to session — exercise picker opens; filter by body section or workout type |
| 6 | User | Logs a set (weight, reps, or cardio fields) |
| 7 | System | `POST /session-exercises/:id/sets` — see TF-03 for offline variant |
| 8 | System | Checks historical max (1RM Epley, volume) for this client + exercise |
| 9 | System | Sets `isPR = true` and/or `isPRVolume = true` if new personal record |
| 10 | System | Returns set with PR flags; fires PR flash if applicable |
| 11 | System | Rest timer starts automatically |
| 12 | User | Repeats steps 5–11 for remaining exercises and sets |
| 13 | User | Taps "End Session" |
| 14 | System | Prompts for subjective scores (energy, mobility, stress — 3 sliders) |
| 15 | User | Submits scores |
| 16 | System | `PATCH /sessions/:id` → status: `completed`; records `endTime` and scores |
| 17 | System | Navigates to session summary screen |

**End state:** Session is `completed` with all sets recorded, subjective scores captured, PR flags set.

**Failure paths:**
- Step 5 fails (network) → if offline, falls through to TF-03 for set logging; session creation itself requires network
- Step 9 fails (network mid-session) → falls through to TF-03
- Step 18 fails → session stays `in_progress`; user can retry completing; subjective scores are optional
- User exits app mid-session → session stays `in_progress`; overlay pill persists; user can restore and continue

**Obstacles:**
- ⚠️ **Session creation requires network — offline path is queued UUID design, not yet implemented.** The intended approach: client generates a UUID (`crypto.randomUUID()`) before going online, queues `POST /sessions` with that UUID in the body, queues downstream session-exercises and sets referencing it. Backend must accept a client-provided `id` on `POST /sessions`, `POST /session-exercises`, and `POST /sets`. Replay order in the offline queue must be: session → sessionExercises → sets. Until implemented, session creation blocks with a clear "You need internet to start a new session" message — never a generic error.
- ⚠️ PR detection (step 10) queries historical sets — this is a server-side query. Offline PR detection is not implemented.

---

## TF-03: Log a set while offline

**Trigger:** User attempts to log a set (TF-02 step 8) while `navigator.onLine === false`.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Submits set (weight + reps or cardio fields) |
| 2 | System | Detects offline state |
| 3 | System | Writes operation to `offlineQueue` (IndexedDB) — preserves method, path, body, description |
| 4 | System | Optimistically updates local UI (set appears as logged) |
| 5 | System | OfflineBanner updates: "Offline — X writes queued" |
| 6 | User | Continues session; additional sets queue the same way |
| 7 | System | `window` fires `online` event when connectivity returns |
| 8 | System | `syncService.flushQueue()` runs — replays queued operations in order |
| 9 | System | OfflineBanner updates: "Syncing X writes…" |
| 10 | System | Each operation POSTed to server; on success, removed from queue |
| 11 | System | Dispatches `trainer-app:sync-complete` DOM event |
| 12 | System | TanStack Query cache invalidated; data refreshes from server |
| 13 | System | OfflineBanner disappears |

**End state:** All queued sets are persisted to the server; local state matches server state.

**Failure paths:**
- Step 10 fails (server error on one operation) → `retryCount` incremented on that item; after `MAX_RETRIES` the item is dropped from queue
- Partial sync failure → OfflineBanner shows "X writes failed to sync — tap to retry"; user can manually trigger flush
- App closed before sync completes → queue persists in IndexedDB; sync resumes on next app open when online

**Obstacles:**
- ⚠️ PR detection does not run for offline-logged sets. Sets are flagged as PRs by the server at log time. A set logged offline will have `isPR = false` even if it was a personal record. **Decision: post-sync PR recompute pass added to backlog.** After `sync-complete` fires, a background job (or a new `POST /session-exercises/:id/recompute-prs` endpoint) should recheck PR flags for any sets that were synced in that flush.
- ⚠️ The `sync_log` table exists in the database schema but is not wired to the sync flow. The current offline queue is `offlineQueue` (IndexedDB only). The server-side `sync_log` was intended for conflict detection — this gap should be noted for Phase 8 work.

---

## TF-04: Plan a session in advance

**Trigger:** User wants to build a session for a future date (or "plan the day" for a client).

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens session plan panel (from client profile or dashboard CTA) |
| 2a | System | **If Athlete:** auto-selects self-client |
| 2b | System | **If Trainer:** uses the client context the panel was opened from |
| 3 | System | `POST /sessions` → status: `planned` (no `startTime` set) |
| 4 | User | Adds exercises; sets target values (weight, reps) |
| 5 | System | Saves exercises as `session_exercises` with `target_*` fields; `workoutType` inferred from exercise record |
| 6 | User | Optionally loads a template (see TF-05) |
| 7 | User | Names the session (optional) |
| 8 | User | Saves or dismisses — panel minimises to a pill |
| 9 | User | On training day: opens the planned session and taps "Start" |
| 10 | System | `PATCH /sessions/:id` → status: `in_progress`; records `startTime` |
| 11 | System | Transitions to live session view with pre-populated exercises and target values |

**End state:** Session has `planned` status with all structure in place; transitions to `in_progress` on execution.

**Failure paths:**
- Steps 3–5 fail (network) → session plan cannot be saved offline; the plan builder requires network for persistence. Offline planning is not implemented. Clear message required.
- User closes the session plan panel before saving → session remains as a draft or is discarded depending on whether step 3 already fired

**Obstacles:**
- ⚠️ Multiple planned sessions can be open simultaneously (one per client). The session plan pill stack must not overflow or obscure navigation. Cap needs definition — currently undefined.

---

## TF-05: Apply a template to a session

**Trigger:** User selects "Load template" from inside a session plan panel or session launcher.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens template picker (bottom sheet) |
| 2 | System | Fetches template list for this trainer |
| 3 | User | Selects a template |
| 4 | System | Checks if session already has exercises |
| 5a | System | **If empty:** applies template directly |
| 5b | System | **If has exercises:** prompts "Replace existing exercises?" |
| 6 | System | Copies `template_exercises` → `session_exercises` with `target_*` values; `workoutType` carried from template_exercise record |
| 7 | System | Session plan panel refreshes with populated exercises |

**End state:** Session has exercises and target values populated from the template.

**Failure paths:**
- Step 2 fails (network) → template list cannot load; user sees empty picker or error; templates are not prefetched offline
- Step 6 fails → session remains empty; error shown; user can retry

---

## TF-06: Browse exercises and add to a session

**Trigger:** User navigates to the Exercises page, or taps "Add exercise" inside a live session or plan.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens exercise library |
| 2 | System | Loads exercise list (prefetched by syncService on app load) |
| 3 | User | Filters by body section, workout type, and/or searches by name |
| 4 | User | Taps an exercise to view detail |
| 5 | System | Checks if any session is open (planned, building, or active) |
| 6a | System | **No open session:** "Add to Session" CTA is disabled |
| 6b | System | **One open session:** "Add to Session" adds directly |
| 6c | System | **Multiple open sessions:** shows session picker sheet |
| 7 | User | Confirms target session (if picker shown) |
| 8 | System | `POST /session-exercises` — adds exercise to the session; `workoutType` inferred from exercise record |

**End state:** Exercise is added to the chosen session.

**Failure paths:**
- Step 8 fails (network, user is offline) → write queued in offlineQueue; exercise appears added locally
- Exercise is a draft (`isDraft=true`) → shown with amber badge; "Add to Session" is available but the exercise has no media and minimal metadata

---

## TF-07: View session history and per-exercise context

**Trigger:** User wants to review past sessions or see what they lifted last time on a specific exercise.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens training profile (Athlete: My Training; Trainer: client profile) |
| 2 | User | Navigates to Timeline tab |
| 3 | System | Fetches session list for this client (sorted by date, newest first) |
| 4 | User | Taps a session card |
| 5 | System | Fetches full session detail (sessionExercises → sets) |
| 6 | System | Renders session detail with set-by-set breakdown and PR chips |
| 7 | User | During a live session: taps exercise name to open per-exercise history drawer |
| 8 | System | Fetches last 3 sessions where this client logged this exercise |
| 9 | System | Displays weight, reps, RPE per set per session for context |

**End state:** User has the historical context they need to inform the next set.

**Failure paths:**
- Step 3/5 fails (offline) → cached session list and detail served from Workbox cache if previously loaded; first-time loads fail with offline state
- Step 8 fails (offline) → per-exercise history drawer shows empty or cached state

---

## TF-08: View training profile

**Trigger:** User wants to see their own (Athlete) or a client's (Trainer) full profile — goals, snapshots, session history.

| Step | Actor | Action |
|---|---|---|
| 1a | System | **Athlete:** user taps "My Training" in nav |
| 1b | System | **Trainer — self:** user taps "My Training" in nav |
| 1c | System | **Trainer — client:** user taps a client card on the Clients page |
| 2 | System | Resolves the correct Client ID |
| 3 | System | For Athlete and Trainer self: fetches `GET /clients/self` to resolve isSelf client ID |
| 4 | System | **Athlete:** renders `AthleteProfilePage` *(gap: currently redirects to `/clients/:id`)* |
| 4b | System | **Trainer:** renders `ClientProfilePage` |
| 5 | System | Loads 3 tabs: Overview (KPIs, goals, active challenge), Timeline (session list), Baseline (snapshots) |

**End state:** Profile is visible with all three data domains accessible.

**Failure paths:**
- Step 3 fails (self-client not found) → error state; this indicates a registration bug (isSelf client not created)
- Offline → tabs render from Workbox cache if previously visited; first-time profile visits fail

**Obstacles:**
- ⚠️ **Athlete sees `/clients/:id` in the URL bar** — `MyTrainingPage` currently resolves self-client ID then navigates to `/clients/:selfClientId`. This leaks the Roster context into the Athlete experience. Must be resolved: `AthleteProfilePage` renders directly at `/my-training`, no redirect.

---

## TF-09: Set a goal and mark it achieved

**Trigger:** User (or Trainer for a client) wants to record a training intent.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens training profile → Overview tab |
| 2 | User | Taps "Add goal" |
| 3 | User | Enters goal text |
| 4 | System | `POST /clients/:id/goals` — creates goal with `achievedAt: null` |
| 5 | System | Goal appears at top of goal list (ordered by creation, newest first) |
| 6 | User | When goal is reached: taps "Mark achieved" |
| 7 | System | `PATCH /clients/:id/goals/:goalId` — sets `achievedAt` to current timestamp |
| 8 | System | Goal moves to achieved state; remains in history (never deleted) |

**End state:** Goal history is append-only. Achieved goals are visible in the arc for reporting.

**Failure paths:**
- Step 4 fails (offline) → write queued; goal appears optimistically; syncs when online
- Goals are append-only by design — there is no delete path

---

## TF-10: Add an external client (Trainer only)

**Trigger:** Trainer wants to start working with a new client.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Taps "Add client" on Clients page |
| 2 | System | Opens ClientDrawer (form: name, email, phone, focus, progressionState) |
| 3 | User | Fills in details and submits |
| 4 | System | `POST /clients` — creates Client record linked to this Trainer |
| 5 | System | Drawer closes; new client card appears in the roster |
| 6 | System | Trainer can now log sessions, goals, and snapshots against this client |

**End state:** Client exists in roster; full session and tracking lifecycle is available.

**Failure paths:**
- Step 4 fails (network) → drawer shows error; no client created; form data preserved for retry
- Trainer is offline → client creation requires network; no offline path

**Obstacles:**
- ⚠️ No invite flow — clients don't have their own accounts (yet). The client record is trainer-owned data. If a client portal is added (Phase 9), the link between a client record and a client-facing account will need to be defined.

---

## TF-11: Send a monthly report (Trainer only)

**Trigger:** Trainer taps "Send Report" on a client profile.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Taps "Send Report" on client profile |
| 2 | System | Queues report generation job in BullMQ (Redis) |
| 3 | System | Worker fetches: client goals, snapshots, session history, KPI metrics for the period |
| 4 | System | Renders HTML email template (goal arc + key metrics + trend commentary) |
| 5 | System | Sends via Resend to the client's email address |
| 6 | System | Increments `trainer.reportsSentCount` |
| 7 | System | Surfaces confirmation to the trainer ("Report sent") |

**End state:** Client has received their report email; trainer has confirmation.

**Failure paths:**
- Step 2 fails (Redis unavailable) → job not queued; trainer sees error; no retry mechanism currently
- Step 5 fails (Resend error) → job fails in worker; trainer may not be notified; no retry UI currently
- Client has no email address → report cannot be sent; gate check required before step 2

**Obstacles:**
- ⚠️ No retry UI for failed reports. BullMQ has built-in retry logic but the trainer has no visibility into failure state. A "Resend" button and failure notification are needed.
- ⚠️ No push notification when report dispatches successfully. Trainer learns of success only if they're watching the UI.

---

## TF-12: Install the app to home screen

**Trigger:** Browser fires `beforeinstallprompt` event (Chrome/Android) or user manually selects "Add to Home Screen" (iOS Safari).

| Step | Actor | Action |
|---|---|---|
| 1 | System | `beforeinstallprompt` event fires and is captured; prompt is deferred (not shown immediately) |
| 2 | System | A passive install icon appears in the nav bar (always visible once PWA is installable; does nothing obnoxious — just sits there for users who are looking for it) |
| 3 | User | Taps passive install icon at any time → goes to step 5; OR waits for contextual prompt |
| 4 | System | After user completes their **first session** (`SessionCompleted` event), app surfaces a one-time contextual nudge: "Add to your home screen for the best experience" |
| 5 | System | Shows the browser's native install prompt (triggered by user gesture in step 3 or 4) |
| 6 | User | Confirms installation |
| 7 | System | App is added to home screen; subsequent launches open in standalone mode (no browser chrome) |
| 8 | System | `onappinstalled` event fires; passive install icon is hidden; nudge is never shown again |

**End state:** App is installed; user launches it like a native app.

**Failure paths:**
- iOS: `beforeinstallprompt` does not fire. User must manually use Safari's share sheet → "Add to Home Screen". No programmatic prompt is possible on iOS.
- User dismisses the prompt → prompt is consumed; cannot be shown again in the same session. App should not nag.
- App fails Lighthouse installability checks → prompt never fires. Must pass PWA audit.

**Obstacles:**
- ⚠️ The contextual nudge trigger (step 3) is not yet defined or implemented. "After first completed session" is a reasonable candidate — needs a design decision and implementation.
- ⚠️ iOS install flow cannot be initiated by the app. An iOS-specific explainer (e.g. "Tap Share → Add to Home Screen") is needed for iOS users who want to install.

---

## TF-13: Offline queue flush on reconnect

**Trigger:** `window` fires `online` event after a period of offline use with queued writes.

| Step | Actor | Action |
|---|---|---|
| 1 | System | `syncService` detects `online` event |
| 2 | System | Reads all pending operations from `offlineQueue` (IndexedDB), ordered by timestamp |
| 3 | System | Emits `sync-status: syncing` → OfflineBanner shows "Syncing X writes…" |
| 4 | System | Replays each operation against the API in order |
| 5 | System | On each success: removes operation from queue |
| 6 | System | On each failure: increments `retryCount`; drops after `MAX_RETRIES` |
| 7 | System | After flush: dispatches `trainer-app:sync-complete` DOM event |
| 8 | System | TanStack Query cache is invalidated; data refreshes from server |
| 9 | System | OfflineBanner disappears (if queue empty) or shows error state (if failures remain) |

**End state:** All queued writes are persisted; UI reflects server state.

**Failure paths:**
- One operation fails permanently → dropped after MAX_RETRIES; data is lost. User is not currently notified of individual operation failures — only the aggregate error count.
- Connectivity drops again mid-flush → flush stops; remaining items stay queued; will retry on next `online` event
- App is closed mid-flush → queue persists in IndexedDB; resumes next time app opens with network

**Obstacles:**
- ⚠️ Operations are replayed in insertion order. If a set depends on a session that also failed to create (step 5 of TF-02), the set replay will fail because the server session doesn't exist. Order dependency is not validated before replay.
- ⚠️ `sync_log` server-side table is not wired. Conflict detection between two devices is not implemented. If the same client session was modified on two devices while both were offline, the second sync wins silently.

---

---

## TF-14: Capture a snapshot (measurements + subjective scores)

**Trigger:** Trainer or Athlete wants to record a point-in-time measurement for a training profile.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens training profile → Baseline tab |
| 2 | User | Taps "Add Snapshot" |
| 3 | System | Opens snapshot form with all measurement sections |
| 4 | User | Fills in any combination of: body comp (weight, height, body fat %, lean mass, BMI), circumference (waist, hips, chest, biceps L/R, quads L/R, calves L/R), cardiovascular (resting HR, blood pressure, VO2 max), functional (push-ups, pull-ups, plank, mile time, sit-and-reach, grip), subjective scores (energy, sleep, stress, mobility, self-image 1–10) |
| 5 | System | All fields are optional — form never blocks on missing data |
| 6 | User | Adds optional trainer notes and client notes |
| 7 | User | Submits |
| 8 | System | `POST /clients/:clientId/snapshots` — creates snapshot record with `capturedAt`, `capturedBy`, and `progressionState` at time of capture |
| 9 | System | New snapshot appears on Baseline tab |
| 10 | System | If a previous snapshot exists: computes and displays delta for each measurement ("−2.1 lbs", "+0:45 mile time") |

**End state:** Snapshot is stored with all provided measurements. Baseline tab shows the new entry with deltas from the prior snapshot.

**Failure paths:**
- Step 8 fails (network) → snapshot not saved; offline snapshot capture is not currently queued. Clear error + retry option needed.
- No prior snapshot exists → deltas are not shown on first snapshot (nothing to compare to)

**Obstacles:**
- ⚠️ Progression state at capture time is stored on the snapshot, not derived at query time. If the trainer changes the client's progression state later, historical snapshots still carry the old value — this is intentional (accurate historical record).

---

## TF-15: Attach a progress photo to a snapshot

**Trigger:** User wants to add visual documentation to an existing snapshot. Snapshot must exist first (see TF-14).

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens snapshot (from Baseline tab) |
| 2 | System | Renders 4-pose camera grid: Front, Side L, Side R, Back |
| 3 | System | Checks `client.progressPhotosOptedOut` — if true, shows opt-out message and skips photo UI |
| 4 | User | Taps a pose button (e.g. "Front") |
| 5 | System | Triggers `<input type="file" capture="environment">` — or `capture="user"` for self-tracking (Athlete / isSelf) |
| 6 | User | Takes photo with camera or selects from gallery |
| 7 | System | Validates client-side: must be image type; max 10 MB |
| 8 | System | `POST /snapshots/:id/media` as multipart form (snapshotId, clientId, file, pose) |
| 9 | System | Backend reads buffer from multipart upload |
| 10 | System | Uploads buffer to Cloudinary → receives `url`, `publicId`, `width`, `height` |
| 11 | System | Inserts into `snapshot_media` table with Cloudinary URL, publicId, pose, and optional `shareable` flag |
| 12 | System | Photo appears as thumbnail in the pose grid; pose slot switches from camera button to thumbnail |
| 13 | User | Can retake (replaces Cloudinary asset + DB record) or delete (removes from Cloudinary + DB) |

**Display flow (ProgressPhotoTimeline):**
| Step | Actor | Action |
|---|---|---|
| 1 | System | `GET /clients/:id/progress-photos` returns photos grouped by snapshot date |
| 2 | System | Renders chronological grid on Baseline tab — latest snapshot at top |
| 3 | User | Taps "Compare" button (visible when ≥2 snapshot groups exist) |
| 4 | System | Opens `PhotoComparisonSlider` — side-by-side before/after for the same pose |
| 5 | User | Taps individual photo → `ProgressPhotoModal` (full-screen view) |

**End state:** Photos are stored in Cloudinary, referenced in DB, displayed per-pose on the Baseline tab, and available for before/after comparison.

**Failure paths:**
- Step 7 fails client-side → error shown inline; no upload attempted
- Step 10 fails (Cloudinary error) → upload fails; user sees error; pose slot stays empty; retry by tapping again
- Step 10 fails offline → no offline path for photo upload; clear error required (photos require network)
- Client has opted out → entire photo section is hidden with a one-line explanation

**Obstacles:**
- ⚠️ `shareable` flag controls whether the photo appears in the monthly report. Two modes (controlled by `photoSharingPreference` trainer preference): `share_all` (all photos shareable) or `share_selected` (per-photo toggle). The toggle is only visible in `share_selected` mode.
- ⚠️ Athlete mode uses `capture="user"` (front-facing camera) by default — `isSelfTracking` prop on `SnapshotPhotoCapture`. Ensure this prop is correctly passed when the Athlete views their own profile.

---

## TF-16: Build a template from scratch

**Trigger:** User wants to create a reusable workout plan to apply to future sessions.

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to Templates page and taps "New template", OR taps "Save as template" from a session plan panel |
| 2 | System | Opens `TemplateBuilderSheet` (bottom sheet, 95vh) in creation mode (`templateId = null`) |
| 3 | User | Selects template type: [ Session ] or [ Workout ] (default: Session) |
| 4 | User | Enters template name (required) and optional description |
| 5 | User | Taps "Create" |
| 6 | System | Validates: name must not be empty |
| 7 | System | `POST /templates` → creates template record with `type`; returns template ID |
| 8 | System | Sheet switches to edit mode with the new `templateId`; toast: "Template created! Now add exercises." |
| 9 | User | Taps "Add Exercise" |
| 10 | System | Opens `TemplateExercisePickerSheet` — filter by body section and workout type. For Workout templates: exercise picker pre-filtered to the template's workout type (advisory — user can clear filter). |
| 11 | User | Searches / filters and selects one or more exercises |
| 12 | System | For each selected exercise: `POST /templates/:id/exercises` with target values (sets, reps, weight, duration); `workoutType` inferred from exercise record; `sortOrder` assigned |
| 13 | System | Exercises appear in the list ordered by `sortOrder`, each with a drag handle |
| 14 | User | Repeats steps 9–13 for additional exercises |
| 15 | User | Drags exercises to reorder — `PUT /templates/:id/exercises/reorder` with new `sortOrder` values |
| 16 | User | Taps "Done" → sheet closes |

**Save-as-template from session plan:**
| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens overflow menu in session plan panel |
| 2 | User | Taps "Save as template" |
| 3 | System | Prompts for template name and type (Session / Workout) |
| 4 | System | `POST /templates` → creates template record |
| 5 | System | Copies session's `session_exercises` → `template_exercises` (targets inherited from session actuals; `sortOrder` preserved) |
| 6 | System | Toast: "Saved as template" |

**End state:** Template exists with a flat ordered exercise list and target values. Available in the template picker for future sessions.

**Failure paths:**
- Step 7 fails (network) → template not created; form stays open; clear error + retry
- Step 4 fails on save-as (network) → template not saved; toast error; session plan unchanged
- User closes sheet before step 5 (before creating) → nothing is saved; no orphan records
- User closes sheet after step 7 (after creating, before adding exercises) → empty template is saved; visible in template list; user can edit later

**Obstacles:**
- ⚠️ A template created in step 7 but closed before adding exercises results in an empty template in the library. Consider: auto-delete empty templates on sheet close, or let them persist and let the user delete them manually. Current behavior: persists.
- ⚠️ Drag-to-reorder (step 15) sends a reorder call on every drag end. High-frequency drags could create a burst of API calls. Debounce or optimistic-only with single save on close.

---

## Cross-flow contradictions

**⚡ TF-02 (start session) vs TF-03 (log set offline):**
Session creation requires network (TF-02 step 5), but set logging works offline (TF-03). If the user goes offline *after* creating the session but *before* logging any sets, TF-03 handles it correctly. If the user goes offline *before* creating the session, there is no offline path for session creation — the session cannot be queued because its ID doesn't exist yet and downstream sets reference it by ID.
**Resolution needed:** Either accept that session creation requires connectivity (document this as a known constraint), or queue session creation with a client-generated UUID and replay the full chain. Current state: blocks with an error.

**⚡ TF-05 (apply template) vs TF-04 (existing plan content):**
Applying a template to a session that already has exercises prompts "Replace existing exercises?" This is a destructive action with no undo.
**Resolution:** The confirmation prompt is the resolution. Confirm the copy is intentional.

**⚡ TF-08 (view training profile) — Athlete URL leakage:**
The Athlete flow currently routes to `/clients/:selfClientId`. This puts the Roster context vocabulary into the Athlete experience, and makes `/clients/:id` accessible to Athletes via direct URL.
**Resolution:** `AthleteProfilePage` must render at `/my-training` directly. `/clients` and `/clients/:id` must redirect Athletes to `/`. This is a Must-be gap (see `kano.md`).

---

## Missing flows

- ❓ **Athlete → Trainer upgrade** — the path from an Athlete account to a Trainer account (data migration, isSelf assignment, billing) is deferred but should eventually be a first-class flow.
- ❓ **Password reset** — deferred, but will be needed before broad public launch.
- ❓ **Post-sync PR recompute** — after sync-complete fires, recheck PR flags for synced sets. Added to backlog.

---

## Context grouping

| Bounded context | Flows |
|---|---|
| **Identity** | TF-01 (register + onboard) |
| **Athlete** | TF-08 (training profile — Athlete path), TF-09 (goals) |
| **Roster** | TF-08 (client profile — Trainer path), TF-09 (goals for client), TF-10 (add client) |
| **Training** | TF-02 (live session), TF-03 (offline set), TF-04 (plan session), TF-05 (apply template), TF-06 (exercise library), TF-07 (session history) |
| **Insight** | TF-11 (monthly report) |
| **Sync** | TF-03 (offline set — queuing half), TF-13 (reconnect flush) |
| **PWA** | TF-12 (install), TF-13 (sync) |
| **Athlete / Roster** | TF-14 (snapshot capture), TF-15 (progress photo) |
| **Training** | TF-16 (template builder) — add to Training context |
