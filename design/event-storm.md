# Event Storm — TrainerApp

**Phase 0 artifact — draft for review**
**Last updated:** 2026-06-18

---

## How to read this document

An event storm maps the things that can happen in a system — past-tense facts — then traces what caused them and what they cause in turn. This is the precursor to the bounded-context map and the service/schema design.

**Swimlane legend**

| Symbol | Meaning | Sticky colour |
|--------|---------|---------------|
| **[EVT]** | Domain Event — something that happened; past tense; never undone | Orange |
| **[CMD]** | Command — the user or system intent that caused the event | Blue |
| **[AGG]** | Aggregate — the thing the command acts on | Yellow |
| **[POL]** | Policy — automatic reaction to an event ("when X, do Y") | Purple |
| **[READ]** | Read Model / Projection — a query that must be efficient | Green |
| **[EXT]** | External System — outside our process boundary | Pink |

Events are grouped by **bounded context** (the domain area they belong to). The order within each section is chronological — how they flow through a typical user journey.

---

## Bounded contexts

1. **Identity** — auth, onboarding, device management
2. **Training** — sessions, sets, exercises, templates, PR detection, rest timer
3. **Sync** — offline queue, flush, conflict log
4. **Athlete** — personal profile, goals, snapshots, progress photos
5. **Roster** — client management, at-risk monitoring (Trainer only)
6. **Insight** — monthly reports, KPIs, trend data (Trainer only)
7. **PWA** — install lifecycle, push notifications, service worker
8. **Billing** — subscription lifecycle, Stripe integration, feature gating

---

---

## 1. Identity

Everything that creates, authenticates, or scopes a user.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **TrainerRegistered** | RegisterAccount | Trainer | Creates the `trainers` row; isSelf Client created immediately after |
| **isSelfClientCreated** | (POL) after TrainerRegistered | Client | Auto-created; `isSelf = true`; never appears in the Roster |
| **OnboardingCompleted** | SelectMode | Trainer | Sets `trainerMode` (`athlete` \| `trainer`) and `onboardedAt`; gates all subsequent navigation |
| **TrainerLoggedIn** | Login | Trainer | JWT issued (15 min, memory); refresh token issued (7 day, httpOnly cookie) |
| **TokenRefreshed** | (POL) on 401 TOKEN_EXPIRED | Trainer | Transparent; original request retried after new token issued |
| **TrainerLoggedOut** | Logout | Trainer | Token cleared from memory; cookie cleared server-side |
| **DeviceRegistered** | (POL) first API call from new device | Device | `X-Device-ID` header; `localStorage` UUID; used to scope refresh tokens |
| **TrainerDeactivated** | DeactivateAccount | Trainer | Soft-delete: `deactivatedAt` timestamp set; account inaccessible. Cascades: all refresh tokens revoked, Stripe subscription cancelled, client records soft-deleted. Hard delete (GDPR erasure) is a separate follow-up process. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| RegisterAccount | Anonymous | No existing account with this email |
| SelectMode | Trainer (unauthenticated profile) | `onboardedAt` is null |
| Login | Anonymous | Account exists |
| Logout | Authenticated trainer | Session active |
| RefreshToken | System (interceptor) | Refresh cookie valid |
| DeactivateAccount | Authenticated trainer | Account active; confirmed via re-authentication or confirmation dialog |

### Policies

| Trigger event | Policy | Resulting command |
|---------------|--------|-------------------|
| TrainerRegistered | Create isSelf Client immediately, in the same transaction | CreateClient `{ isSelf: true }` |
| TrainerRegistered | Redirect to `/onboard` | NavigateTo `/onboard` |
| OnboardingCompleted (athlete) | Show athlete nav; block client routes | EnforceAthleteRouteGuard |
| OnboardingCompleted (trainer) | Show trainer nav; make Roster accessible | ShowTrainerNav |
| TokenRefreshed | Retry original failed request | RetryRequest |
| Token TTL < 1 min (future) | Proactive silent refresh | RefreshToken |
| TrainerDeactivated | Revoke all refresh tokens for this trainer | Invalidates all active sessions across all devices |
| TrainerDeactivated | Cancel Stripe subscription immediately (if active) | Billing context; no refund — access ends at deactivation |
| TrainerDeactivated | Soft-delete all isSelf and external client records | Cascades to sessions, sets, goals, snapshots — data retained for GDPR erasure window |

### Read models

| Projection | Used by |
|-----------|---------|
| `currentTrainer` — id, email, trainerMode, onboardedAt, preferences | Every authenticated route; `useAuthStore` |
| `deviceList` — active refresh tokens by device | Future: device management page |

---

---

## 2. Training

The core domain. Session lifecycle, set logging, exercise library, templates, PR detection, rest timer.

### Session lifecycle events

```
SessionPlanned → SessionStarted ─┐
SessionCreated → SessionStarted ─┤→ {SetLogged}* → SessionCompleted
SessionStarted (jump-in) ────────┘             └→ SessionSavedAsPartial (≥1 sets logged)
                                               └→ SessionCancelled / Discarded
```

Three creation paths — all converge at `SessionStarted`:
- **Planned ahead**: `PlanSession` → `SessionPlanned` (status: `planned`) → `SessionStarted`
- **Build-first (manual or template)**: `CreateSession` → `SessionCreated` (status: `building`) → `SessionStarted`
- **Jump-in**: `StartSession` directly → `SessionStarted` (status: `in_progress`; empty exercise list; exercises added one at a time from library)

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **SessionPlanned** | PlanSession | Session | Status: `planned`. No `startTime`. Can have exercises pre-added via template. |
| **SessionCreated** | CreateSession | Session | Status: `building`. Session record created before starting. `source: 'manual' \| 'template'`. Optional `templateId` (template path: exercise list copied from template; user reviews then starts). Manual path: user adds exercises in the builder UI, then starts. |
| **SessionStarted** | StartSession | Session | Status: `planned \| building → in_progress`. `startTime` recorded. Overlay opens. If jump-in (no prior `planned` or `building` record): session record created and started atomically. TRAIN card entry paths: (1) "Start Training" = jump-in or build-first start; (2) "Begin: [name]" = start existing `planned` session; (3) "Resume: [name]" = navigation only — no event emitted, overlay reopens. |
| **ExerciseAddedToSession** | AddExercise | SessionExercise | Direct session → session_exercise relationship (no block container). `workoutType` inferred from exercise record. `targetWeight`, `targetReps` optional (from template or manual). `sortOrder` maintained. |
| **SetLogged** | LogSet | Set | `weight`, `reps` (or cardio fields). PR check runs immediately. `isPR` and `isPRVolume` set. |
| **PersonalRecordDetected** | (POL) after SetLogged | Set | `isPR = true` OR `isPRVolume = true`. Triggers PR flash + rest timer. |
| **RestTimerStarted** | (POL) after SetLogged | Session | Countdown from `restDurationSeconds` preference. Persists across navigation. |
| **SubjectiveScoresCaptured** | SubmitSessionSummary | Session | Energy, mobility, stress sliders. RPE. Optional notes. |
| **SessionCompleted** | CompleteSession | Session | Status: `in_progress → completed`. `endTime` recorded. Subjective scores attached. |
| **SessionSavedAsPartial** | SaveSessionAsPartial | Session | Status: `in_progress → partial`. Triggered from dismiss sheet when ≥1 sets logged. Session marked "cut short" in history. Distinct from completed — no subjective scores captured. |
| **SessionCancelled** | DiscardSession | Session | Status: `in_progress → cancelled`. Triggered by the Discard action in the dismiss sheet. Sets are preserved but session is terminal. If 0 sets logged: only option. If ≥1 sets logged: user chose Discard over Save as Partial. |
| **ExerciseRemovedFromSession** | RemoveExercise | SessionExercise | Exercise and its sets removed. `sortOrder` of remaining exercises compacted. |
| **ExercisesReordered** | ReorderExercises | Session | `sortOrder` updated across session_exercises. Debounce required on API call. |

### Template events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **TemplateCreated** | CreateTemplate | Template | Name required. `type` field: `'session'` (exercises may span multiple workout types) or `'workout'` (WorkoutTemplate — all exercises share one workout type; a focused block e.g. "Leg Day"). Empty template is valid (gap — see G12). Structure is flat for both types: `template → template_exercises`. |
| **TemplateExerciseAdded** | AddExerciseToTemplate | TemplateExercise | Direct template → template_exercise relationship. `workoutType` carried from exercise record. `targetWeight`, `targetReps` for progressive overload reference. `sortOrder` maintained. |
| **TemplateExercisesReordered** | ReorderTemplateExercises | Template | `sortOrder` updated. @dnd-kit; debounce API calls. |
| **TemplateSavedFromSession** | SaveSessionAsTemplate | Template | Copies session's exercise list (session_exercises) into template_exercises; targets inherited from session actuals. |
| **TemplateAppliedToSession** | ApplyTemplate | Session | Copies template_exercises → session_exercises. Prompts if session already has exercises. |
| **TemplateDeleted** | DeleteTemplate | Template | Soft-delete preferred (past sessions retain their exercise history). |

### Exercise library events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **ExerciseLibraryLoaded** | (POL) app start | ExerciseLibrary | 109 exercises prefetched by syncService; cached for offline use. |
| **ExerciseFiltered** | FilterExercises | ExerciseLibrary | Client-side filter — no server call. Primary dimensions: **body section** (e.g. upper body, lower body, core) and **workout type** (resistance, cardio, mobility, calisthenics). Plus name search. Available during session exercise selection (jump-in, build-first, and swap flows). |
| **ExerciseDetailViewed** | ViewExercise | Exercise | Muscle diagram + demo video (schema exists; content deferred Phase 9). |
| **ExerciseAddedToSession** | AddExerciseFromLibrary | SessionExercise | From the library into an `in_progress` or `building` session. `workoutType` inferred from exercise record. |
| **CustomExerciseCreated** | CreateExercise | Exercise | User-defined exercise. Scoped to this trainer. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| PlanSession | Athlete / Trainer | Authenticated; network required for session creation |
| CreateSession | Athlete / Trainer | Authenticated; no current `in_progress` session for this client. Triggers `SessionCreated` (status: `building`). Source: `'manual'` (empty builder, add exercises before starting) or `'template'` (exercise list pre-populated from template). |
| StartSession | Athlete / Trainer | Session in `planned` or `building` state, OR no prior session record (jump-in — creates and starts atomically). TRAIN card: "Begin: [name]" (planned→in_progress), start from builder (building→in_progress), or "Start Training" with no prior record (jump-in). |
| ResumeSession | Athlete / Trainer | Session in `in_progress` state. TRAIN card: "Resume: [name]". Navigation only — reopens overlay; no domain event emitted. |
| AddExercise | Athlete / Trainer | Session in `planned`, `building`, or `in_progress` state |
| RemoveExercise | Athlete / Trainer | SessionExercise exists; session not `completed` or `cancelled` |
| ReorderExercises | Athlete / Trainer | Session in `planned`, `building`, or `in_progress` state; ≥2 exercises |
| LogSet | Athlete / Trainer | SessionExercise exists; `in_progress` session |
| CompleteSession | Athlete / Trainer | Session `in_progress`; at least one set logged (or override) |
| SaveSessionAsPartial | Athlete / Trainer | Session `in_progress`; ≥1 set logged. Triggered by dismiss sheet "Save as partial" button. |
| DiscardSession | Athlete / Trainer | Session `in_progress`. Triggered by dismiss sheet "Discard" button. If 0 sets: only option. If ≥1 sets: alternative to Save as Partial. |
| CreateTemplate | Athlete / Trainer | Authenticated; network required |
| AddExerciseToTemplate | Athlete / Trainer | Template exists; not deleted |
| ReorderTemplateExercises | Athlete / Trainer | Template exists; ≥2 exercises |
| ApplyTemplate | Athlete / Trainer | Session exists in `planned` or `building` state; template exists |
| SaveSessionAsTemplate | Athlete / Trainer | Session `in_progress` or `completed` |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| SetLogged | Check historical max for client + exercise; set `isPR` / `isPRVolume` | Server-side query; offline: skipped (backlog: post-sync recompute) |
| PersonalRecordDetected | Fire PR flash animation (amber pulse, 2s) | Frontend only; `prNotifyType` preference gates which PR type triggers |
| PersonalRecordDetected | Start rest timer | `restDurationSeconds` from preferences |
| SetLogged (offline) | Queue to IndexedDB `offlineQueue` instead of POST | `offlineAwareApi` checks `navigator.onLine` |
| SessionCompleted | Check if install prompt should fire (see PWA context) | Fires after first ever completed session |
| SessionCompleted | If `autoReportEnabled`: schedule monthly report check | Insight context |
| TemplateAppliedToSession (session already has exercises) | Prompt "Replace existing exercises?" | Destructive action gate |
| Session overlay dismissed (0 sets logged) | Present only [Discard] option | Nothing to save — single action |
| Session overlay dismissed (≥1 sets logged) | Present dismiss sheet with [Save as partial] and [Discard] options | User must explicitly choose; default is non-destructive |
| Swap exercise triggered | Pre-filter exercise picker by the swapped exercise's workout type | Keeps replacement relevant; pre-filter is advisory, not locked |

### Read models

| Projection | Used by |
|-----------|---------|
| `sessionHistory` — sessions by client, ordered by date | SessionsPage; client profile timeline |
| `lastThreeSets(clientId, exerciseId)` — weight × reps per set for last 3 sessions | Inline history context during live session |
| `currentPR(clientId, exerciseId)` — best 1RM estimate and volume PR | PR detection baseline |
| `plannedSessions` — keyed by sessionId, all `planned` sessions across clients | Session pill stack; session launcher |
| `activeSessions` — keyed by clientId, the one `in_progress` session per client | Live session overlay |
| `templateList` — trainer's templates with `type` column (`session` \| `workout`), ordered by last used | Template picker; template library page (tabbed: Session Templates / Workout Templates) |
| `exerciseList` — full library, prefetched | Exercise picker; offline-available |
| `weeklyVolume(clientId, week)` — sum of weight × reps across the week | KPI hero, consistency widget |

---

---

## 3. Sync

Offline queue management, flush on reconnect, conflict detection.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **DeviceWentOffline** | `window offline` event | Device | `navigator.onLine = false`. OfflineBanner transitions to "offline" state. |
| **QueueItemEnqueued** | (POL) failed online write detected by `offlineAwareApi` | OfflineQueue | Item: `{ method, path, body, description, enqueuedAt }`. Stored in IndexedDB. |
| **OfflineBannerUpdated** | (POL) queue count changes | OfflineBanner | States: hidden → offline+none → offline+pending(N) → syncing → error → hidden |
| **DeviceWentOnline** | `window online` event | Device | Triggers flush. |
| **QueueFlushStarted** | (POL) after DeviceWentOnline | OfflineQueue | `syncService.flushQueue()` called; processes items in order. |
| **QueueItemSynced** | Successful replay of queued item | OfflineQueue | Item removed from queue. `sync_log` entry written server-side. |
| **QueueItemFailed** | Server returned error on replay | OfflineQueue | `retryCount` incremented. After MAX_RETRIES: item dropped; error surfaced. |
| **QueueFlushCompleted** | All items processed (success or max retries) | OfflineQueue | `trainer-app:sync-complete` DOM event dispatched. TanStack Query cache invalidated. |
| **SyncConflictDetected** | 409 response during flush | sync_log | Conflict recorded in `sync_log` with both versions. Surface count to user. |
| **SyncLogWritten** | (POL) after any successful server-side mutation | sync_log | `trainerId`, `deviceId`, `tableName`, `recordId`, `operation`, `payload`, `createdLocallyAt`, `syncedAt` |
| **PRRecomputeRequested** | (POL) after QueueFlushCompleted *(backlog)* | Set | Post-sync recheck of `isPR` flags for sets synced in this flush. Endpoint: `POST /session-exercises/:id/recompute-prs` |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| EnqueueWrite | System (`offlineAwareApi`) | `navigator.onLine === false`; write operation attempted |
| FlushQueue | System (`syncService`) | `window online` event; queue non-empty |
| RetryQueueItem | User (tap banner) OR System | Item in error state |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| QueueItemEnqueued | Update OfflineBanner: "+1 queued" | Reactive to IndexedDB change |
| DeviceWentOnline | Start flush immediately | No delay; order: session → workouts → sessionExercises → sets |
| QueueItemSynced | Write `sync_log` entry | Fire-and-forget; never blocks primary response |
| QueueFlushCompleted | Invalidate TanStack Query cache | All queries refetch; UI reflects server state |
| QueueFlushCompleted | Trigger PR recompute for synced sets *(backlog)* | Backlog item; offline PRs missed during sync |
| SyncConflictDetected | Surface conflict count in OfflineBanner | User must decide resolution (future: conflict resolution UI) |

### Read models

| Projection | Used by |
|-----------|---------|
| `offlineQueueCount` — count of pending items | OfflineBanner |
| `offlineQueueItems` — ordered list of pending ops | Flush processor; retry UI |
| `syncLog(recordId)` — history of sync operations for a record | Future: conflict resolution; audit |

---

---

## 4. Athlete

Personal profile management. Goals, snapshots, progress photos. Used by both Athlete users and by Trainers accessing their own isSelf experience.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **AthleteProfileViewed** | ViewProfile | Trainer/Client | For Athlete: at `/my-training` (target state). For Trainer: same `AthleteProfilePage` via "My Training" tab, scoped to isSelf client. |
| **GoalCreated** | CreateGoal | Goal | Title, notes, target date. Append-only table. |
| **GoalAchieved** | MarkGoalAchieved | Goal | `achievedAt` timestamp set. Goal arc grows; used in monthly reports. |
| **GoalDeleted** | DeleteGoal | Goal | Soft-delete only — record persists for report narrative. View hides it. |
| **SnapshotCaptured** | CaptureSnapshot | ClientSnapshot | Up to 34 optional measurement fields. `capturedAt` timestamp. Baseline delta computed vs prior snapshot. |
| **SnapshotBaselineDeltaComputed** | (POL) after SnapshotCaptured | ClientSnapshot | Delta vs prior snapshot computed and stored. Shown on profile. |
| **ProgressPhotoAttached** | AttachProgressPhoto | ProgressPhoto | 1–4 poses (front, side_left, side_right, back). Photo uploaded to Cloudinary; URL stored in DB. Linked to a snapshot. |
| **ProgressPhotoUploaded** | (POL) after AttachProgressPhoto | [EXT] Cloudinary | Upload fires after local selection. Offline: queued. |
| **PhotoComparisonViewed** | OpenPhotoComparison | ProgressPhoto | Two snapshots selected; `PhotoComparisonSlider` renders side-by-side. |
| **KPIsComputed** | (POL) after SessionCompleted | ClientSnapshot / Session | Volume trend, 1RM estimates, streak, consistency score recomputed. Displayed in KPI hero. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| CreateGoal | Athlete / Trainer | Authenticated; clientId scoped |
| MarkGoalAchieved | Athlete / Trainer | Goal exists and not yet achieved |
| CaptureSnapshot | Athlete / Trainer | Authenticated; at least one field filled |
| AttachProgressPhoto | Athlete / Trainer | Snapshot exists (photo attaches to a snapshot) |
| ViewProfile | Athlete / Trainer | Authenticated |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| SnapshotCaptured | Compute delta vs prior snapshot | Compare each field to most recent prior snapshot for same client |
| SessionCompleted | Recompute KPIs for the client | Volume trend, streak, consistency; debounced server-side |
| ProgressPhotoAttached | Upload to Cloudinary | Photo URL written to DB after upload confirms |
| GoalAchieved | Flag goal for inclusion in next monthly report | Insight context picks up `achievedAt` when generating report narrative |

### Read models

| Projection | Used by |
|-----------|---------|
| `athleteProfile(clientId)` — goals, snapshots, session count, KPIs | `AthleteProfilePage`, `ClientProfilePage` |
| `goalArc(clientId)` — all goals ordered by creation, with `achievedAt` | Monthly report narrative; profile goals section |
| `snapshotHistory(clientId)` — snapshots ordered by `capturedAt`, with deltas | Baseline tab; snapshot detail view |
| `progressPhotos(clientId)` — photos grouped by snapshot, ordered by pose | `ProgressPhotoTimeline`; `PhotoComparisonSlider` |
| `kpis(clientId)` — streak, weekly volume, 1RM estimates, consistency score | Dashboard KPI hero; client profile KPI section |

---

---

## 5. Roster

Client management. Trainer-only context. Athletes never receive events from this context.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **ClientAdded** | AddClient | Client | `name`, `email`, `notes`. External client (not isSelf). Immediately appears in roster. |
| **ClientProfileViewed** | ViewClientProfile | Client | `ClientProfilePage` opened (panel or URL). |
| **ClientEdited** | EditClient | Client | Name, email, notes updated. |
| **ClientDeactivated** | DeactivateClient | Client | Soft-delete; client removed from active roster but data retained. |
| **AtRiskThresholdCrossed** | (POL) daily check — 14 days since last session | Client | Client flagged `isAtRisk = true`. Amber badge on roster and dashboard. |
| **AtRiskAlertViewed** | ViewAtRiskAlert | Client | Trainer acknowledged the at-risk signal. |
| **AtRiskStatusCleared** | (POL) after SessionCompleted for this client | Client | Client session recorded; `isAtRisk` resets to `false`; badge removed. |
| **ChallengeAssigned** | AssignChallenge | Challenge | Trainer assigns a challenge to a client. Client sees challenge on their dashboard. |
| **ChallengeProgressUpdated** | (POL) after SetLogged | Challenge | Progress tracked against challenge target. |
| **ChallengeCompleted** | (POL) when progress reaches target | Challenge | `completedAt` set; visible in client's completed challenges list. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| AddClient | Trainer | Authenticated; `trainerMode = 'trainer'` |
| EditClient | Trainer | Client exists; trainer owns client |
| DeactivateClient | Trainer | Client exists; trainer owns client |
| ViewClientProfile | Trainer | Client exists; trainer owns client |
| AssignChallenge | Trainer | Client exists; challenge defined |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| TrainerRegistered | Create isSelf Client | Already in Identity — the isSelf is invisible to the Roster |
| SessionCompleted | Check all of trainer's clients for at-risk threshold | Efficient: only needs last session date per client |
| AtRiskThresholdCrossed | Send push notification to Trainer *(🔜 not built)* | `POST /push/at-risk`; requires push subscription |
| AtRiskThresholdCrossed | Highlight client in amber on roster and dashboard | Read model update |
| SetLogged (for client) | Update challenge progress | Only if client has active challenges targeting this exercise or volume |

### Read models

| Projection | Used by |
|-----------|---------|
| `clientRoster(trainerId)` — clients ordered by last session date, with at-risk flag | `/clients` page; dashboard roster widget |
| `atRiskClients(trainerId)` — clients with no session in 14+ days | Dashboard at-risk widget; roster amber highlights |
| `clientDetail(clientId)` — full profile: goals, snapshots, sessions, challenges | `ClientProfilePage` panel |
| `challengeProgress(clientId)` — active challenges with progress % | Client profile challenge section; Athlete dashboard |

---

---

## 6. Insight

Reporting and trend analysis. Trainer-only.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **MonthlyReportGenerated** | GenerateReport | MonthlyReport | HTML email body assembled: goal arc, key metrics, trend commentary, session timeline. |
| **MonthlyReportPreviewed** | PreviewReport | MonthlyReport | Trainer reviews before sending. |
| **MonthlyReportSent** | SendReport | MonthlyReport | Email dispatched via transactional email provider. |
| **AutoReportTriggered** | (POL) month end + `autoReportEnabled = true` | MonthlyReport | Automatically generates and sends for all clients with sufficient data. |
| **ReportSentConfirmed** | [EXT] Email provider delivery webhook | MonthlyReport | *(🔜 not yet wired)* Delivery confirmation received. |
| **ReportSentPushDelivered** | (POL) after ReportSentConfirmed *(🔜)* | Push | Trainer push notification: "Report sent to [client name]" |
| **KPITrendComputed** | (POL) after SessionCompleted | KPI | Volume trend, 1RM estimates per exercise, consistency score updated. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| GenerateReport | Trainer / System | Client has at least one completed session in the period |
| PreviewReport | Trainer | Report generated |
| SendReport | Trainer / System | Report generated; email address on client record |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| MonthlyReportSent | Record `sentAt` on report | For Trainer's own audit |
| GoalAchieved | Flag for inclusion in next report narrative | Insight picks up `achievedAt` when assembling goal arc |
| SessionCompleted | Recompute KPI trend for client | Feeds report data and dashboard widgets |
| AutoReportTriggered | Generate + send for each client with data | `autoReportEnabled` preference gates this |

### External systems

| System | Events | Notes |
|--------|--------|-------|
| **[EXT] Transactional email** (SendGrid / Resend) | `MonthlyReportSent` | HTML email to client email address |
| **[EXT] Email delivery webhook** | `ReportSentConfirmed` *(🔜)* | Delivery/open events feed back into the system |

### Read models

| Projection | Used by |
|-----------|---------|
| `reportableClients(trainerId)` — clients with data in current period | Report generation UI; auto-report trigger |
| `reportData(clientId, period)` — goal arc, session timeline, volume trend, 1RM deltas | Report template |
| `sentReports(clientId)` — history of reports with `sentAt` and delivery status | Client profile report history tab |

---

---

## 7. PWA

Install lifecycle, push notification subscription. Cross-cutting — affects both Athlete and Trainer contexts.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **InstallPromptCaptured** | `beforeinstallprompt` browser event | Browser | Event stored; native prompt deferred. Passive install icon becomes active. |
| **PassiveInstallIconShown** | (POL) after InstallPromptCaptured | UI | Icon always visible in nav header for eligible browsers. Tap = show prompt. |
| **InstallPromptShown** | (POL) after first `SessionCompleted` + prompt not yet shown | UI | One-time only. iOS: share-sheet instruction card. Chrome/Android: native `prompt()`. |
| **InstallPromptAccepted** | User taps "Add to Home Screen" | Browser | App installed. `installPromptSeen = true` persisted. Icon on home screen. |
| **InstallPromptDismissed** | User dismisses the prompt | Browser | `installPromptSeen = true` persisted. Prompt never shown again. Icon remains. |
| **AppLaunchedStandalone** | User opens app from home screen | Browser | `display-mode: standalone`; auth cookie persists; no browser chrome. |
| **PushPermissionRequested** | RequestPushPermission | Browser | Browser dialog: "TrainerApp wants to send notifications" *(🔜)* |
| **PushPermissionGranted** | User allows notifications | Browser | Push subscription created; `POST /push/subscribe` *(🔜)* |
| **PushPermissionDenied** | User denies notifications | Browser | No retry; push features silently disabled *(🔜)* |
| **PushSubscriptionCreated** | (POL) after PushPermissionGranted | PushSubscription | Endpoint + keys stored server-side *(🔜)* |
| **PushNotificationDelivered** | [EXT] Push gateway → device | Device | At-risk alert, milestone, report sent *(🔜)* |
| **ServiceWorkerActivated** | (POL) app load | ServiceWorker | Workbox / vite-plugin-pwa; handles offline cache + background sync strategy |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| ShowInstallPrompt | System (auto) | `InstallPromptCaptured`; first `SessionCompleted`; not yet shown |
| ShowInstallPromptManual | User (tap passive icon) | `InstallPromptCaptured`; not yet dismissed |
| RequestPushPermission | System or User | Authenticated; not yet granted *(🔜)* |
| SubscribeToPush | System | PushPermissionGranted *(🔜)* |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| `beforeinstallprompt` fires | Capture and defer; show passive icon | Must not show prompt immediately |
| First `SessionCompleted` (ever) | Show install prompt once | Check `installPromptSeen` flag; if false, fire |
| InstallPromptAccepted \| InstallPromptDismissed | Set `installPromptSeen = true` | Persisted; never prompt again |
| AppLaunchedStandalone | Skip browser-chrome-dependent flows | iOS share-sheet explainer not needed; already installed |
| AtRiskThresholdCrossed | Send push to trainer's subscribed devices *(🔜)* | Requires PushSubscriptionCreated |

### External systems

| System | Events | Notes |
|--------|--------|-------|
| **[EXT] Push gateway** (VAPID / Web Push) | `PushNotificationDelivered` | Service worker receives; OS surfaces *(🔜)* |
| **[EXT] Cloudinary** | `ProgressPhotoUploaded` | Progress photo upload and CDN hosting |

---

---

## 8. Billing

Subscription lifecycle, Stripe integration, and feature gating. Trainer-only paying context — Athletes are always free. Owns `subscriptionTier`, `subscriptionStatus`, `trialEndsAt`, `currentPeriodEnd`, and `stripeCustomerId` on the `trainers` row.

### Events

| Event | Caused by | On aggregate | Notes |
|-------|-----------|--------------|-------|
| **StripeCustomerCreated** | (POL) after TrainerRegistered | Trainer | Transparent; `stripeCustomerId` stored on `trainers` row. Fires for all registrations (Athlete and Trainer) so an upgrade path always exists. |
| **TrialStarted** | (POL) after OnboardingCompleted (trainerMode = 'trainer') | Trainer | `subscriptionStatus = 'trialing'`; `trialEndsAt = now + 14 days`; full Pro access unlocked. No payment method required. |
| **TrialEnded** | (POL) cron at `trialEndsAt` | Trainer | If no active subscription → fires `SubscriptionDowngradedToFree`. Email sent. |
| **SubscriptionCreated** | Subscribe | Trainer | Stripe Checkout success → webhook. `subscriptionTier` and `subscriptionStatus` updated. `stripeSubscriptionId` stored. |
| **PaymentSucceeded** | [EXT] Stripe webhook `invoice.payment_succeeded` | Trainer | `currentPeriodEnd` extended; `subscriptionStatus = 'active'`. |
| **PaymentFailed** | [EXT] Stripe webhook `invoice.payment_failed` | Trainer | `subscriptionStatus = 'pastDue'`. Grace period email sent. Billing gate activates on gated actions. |
| **SubscriptionCancelled** | CancelSubscription \| [EXT] Stripe webhook | Trainer | Set to `cancel_at_period_end`; access continues until `currentPeriodEnd`. |
| **SubscriptionDowngradedToFree** | (POL) after TrialEnded \| after `currentPeriodEnd` with cancelled/unpaid status | Trainer | `subscriptionTier = 'free'`; Pro-gated mutations blocked. Existing data read-accessible. |
| **PlanChanged** | ChangePlan | Trainer | Upgrade (Pro → Studio) or downgrade (Studio → Pro); Stripe proration applied. |

### Commands

| Command | Actor | Precondition |
|---------|-------|--------------|
| Subscribe | Trainer | Authenticated; `subscriptionTier = 'free'` or trial expired |
| ChangePlan | Trainer | Active subscription exists |
| CancelSubscription | Trainer | Active subscription exists |
| UpdatePaymentMethod | Trainer | Active subscription exists; Stripe Customer Portal |

### Policies

| Trigger event | Policy | Notes |
|---------------|--------|-------|
| TrainerRegistered | Create Stripe Customer (server-side, transparent) | Enables upgrade at any future point |
| OnboardingCompleted (trainerMode = 'trainer') | Start 14-day Pro trial | No card required; `trialEndsAt` set |
| TrialEnded (no active subscription) | Downgrade to free; send "trial ended" email | Billing gate activates on next gated action |
| PaymentFailed | Enter pastDue; send "payment failed" email + in-app banner | N-day grace period before SubscriptionDowngradedToFree |
| Free/pastDue trainer attempts gated action | Billing gate intercepts; present upgrade modal | Gated actions: AddClient, and any Pro-only mutation |
| SubscriptionCreated / PlanChanged | Update `subscriptionTier` and `subscriptionStatus` on trainers row | Identity context reads these for route/feature gating |

### External systems

| System | Events | Notes |
|--------|--------|-------|
| **[EXT] Stripe** | All subscription events via webhooks | `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `checkout.session.completed` |
| **[EXT] Transactional email** | Trial ended, payment failed, subscription confirmed | Same provider as Insight monthly reports |

### Read models

| Projection | Used by |
|-----------|---------|
| `currentSubscription(trainerId)` — tier, status, trialEndsAt, currentPeriodEnd | `/settings/billing`; nav trial badge; billing gate check |
| `isGated(trainerId, feature)` — boolean; derived from subscriptionTier + status | Billing gate component; server-side route guards |
| `invoiceHistory(trainerId)` — list of past invoices via Stripe API | `/settings/billing` invoice list |

---

---

## Event timeline — full happy path (Athlete)

A single horizontal read through the most common Athlete journey.

```
[CMD] RegisterAccount
  → [EVT] TrainerRegistered
    → [POL] [EVT] isSelfClientCreated
    → [POL] Navigate to /onboard

[CMD] SelectMode (athlete)
  → [EVT] OnboardingCompleted { trainerMode: 'athlete' }
    → [POL] EnforceAthleteRouteGuard
    → [POL] Navigate to /

[CMD] PlanSession (auto-selects selfClient)
  → [EVT] SessionPlanned

[CMD] StartSession
  → [EVT] SessionStarted
    → [POL] Open live session overlay

[CMD] AddBlock
  → [EVT] WorkoutBlockAdded

[CMD] AddExercise
  → [EVT] ExerciseAddedToBlock

[CMD] LogSet (online)
  → [EVT] SetLogged
    → [POL] Check historical max → [EVT] PersonalRecordDetected?
      → [POL] PR flash + rest timer
    → [POL] Write sync_log entry

[CMD] CompleteSession
  → [EVT] SessionCompleted
    → [POL] Recompute KPIs → [EVT] KPIsComputed
    → [POL] Check install prompt → [EVT] InstallPromptShown (first time)
    → [POL] Navigate to session summary

[CMD] CaptureSnapshot
  → [EVT] SnapshotCaptured
    → [POL] Compute baseline delta → [EVT] SnapshotBaselineDeltaComputed

[CMD] AttachProgressPhoto
  → [EVT] ProgressPhotoAttached
    → [POL] Upload to Cloudinary → [EVT] ProgressPhotoUploaded
```

---

## Event timeline — offline set log + flush (both personas)

```
[EVT] DeviceWentOffline
  → [POL] OfflineBanner: "offline — no pending writes"

[CMD] LogSet (offline)
  → [EVT] QueueItemEnqueued
    → [POL] Optimistic UI update (set appears as logged)
    → [POL] OfflineBanner: "offline — N writes queued"

... more sets ...

[EVT] DeviceWentOnline
  → [POL] [CMD] FlushQueue → [EVT] QueueFlushStarted

[EVT] QueueItemSynced (× N)
  → [POL] Write sync_log entry

[EVT] QueueFlushCompleted
  → [POL] Dispatch trainer-app:sync-complete DOM event
  → [POL] Invalidate TanStack Query cache
  → [POL] (backlog) Trigger PR recompute for synced sets
  → [POL] OfflineBanner: hides
```

---

## Gaps and open questions

These items appeared while mapping events and have no clear owner or resolution yet.

| # | Gap | Bounded context | Urgency |
|---|-----|-----------------|---------|
| G1 | `AthleteRouteGuard` not implemented — Athletes can reach `/clients` routes | Identity / PWA routing | Must-be |
| G2 | `MyTrainingPage` redirects to `/clients/:selfClientId` — URL leak | Athlete / Roster | Must-be |
| G3 | `AthleteProfilePage` not yet a separate component from `ClientProfilePage` | Athlete | Must-be |
| G4 | Offline set logging does not detect PRs — `isPR` is always false for queued sets | Training / Sync | High (Backlog) |
| G5 | Post-sync PR recompute endpoint does not exist (`POST /session-exercises/:id/recompute-prs`) | Training / Sync | High (Backlog) |
| G6 | `sync_log` table exists but is not wired to the flush path — only wired to online set log | Sync | Medium |
| G7 | Install prompt fires after `SessionCompleted` — logic not yet implemented in frontend | PWA | High |
| G8 | Push notification infrastructure missing (VAPID, subscription endpoint, delivery) | PWA | Planned |
| G9 | Monthly report delivery webhook (`ReportSentConfirmed`) not wired | Insight | Low |
| G10 | At-risk push notification not built | Roster / PWA | Planned |
| G11 | ~~Athlete billing model undefined~~ — **Resolved by P23–P26 and §8 Billing**: Athletes free forever, Trainer Pro trial and subscription defined, gate behavior specified | Identity | Resolved |
| G12 | Empty template persists in library if user closes builder after creation but before adding blocks | Training | Low |
| G13 | Session plan pill stack cap undefined — multiple planned sessions can overflow nav area | Training | Medium |
| G14 | Template reorder sends API call on every drag-end — needs debounce | Training | Low |
| G15 | `SessionStatus` schema/enum does not yet include `partial` — `SaveSessionAsPartial` command will fail validation until added | Training | Must-be |
| G16 | `templates.type` column (`'session' \| 'workout'`) not yet in schema — WorkoutTemplate creation will fail until column is added | Training | Must-be |
| G17 | Billing context not yet built — `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`, `currentPeriodEnd`, `subscriptionStatus` columns missing from `trainers`; Stripe webhook handler, Checkout flow, and billing gate component all unbuilt | Billing | Must-be before SaaS launch |
| G18 | `TrainerDeactivated` not yet implemented — no `deactivatedAt` column, no deactivation route, no cascade logic, no GDPR hard-delete process | Identity / Billing | Must-be before SaaS launch |
