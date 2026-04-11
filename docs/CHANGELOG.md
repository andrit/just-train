# Changelog

All notable changes to TrainerApp are documented here.
Versions follow [Semantic Versioning](https://semver.org/).

---

## [v2.4.0] — Offline Sync

### Added
- `services/offlineQueue.ts` — persistent write queue behind a storage-agnostic interface. localStorage now, IndexedDB-ready. Implements `.enqueue()`, `.getAll()`, `.remove()`, `.clear()`, `.size()`. Swap one export line to migrate to IndexedDB in v3.x.
- `services/syncService.ts` — two responsibilities: (1) flush the offline queue on reconnect via `window 'online'` event, (2) prefetch clients, planned sessions, and exercise library on app load to warm Workbox cache. Emits `CustomEvent` for status updates and query invalidation.
- `lib/offlineAwareApi.ts` — wraps `apiClient` for mutating requests. If online, attempts normally. If offline or network error, queues the write and returns a stub. GET requests are never queued — handled by Workbox cache.
- `hooks/useOnlineStatus.ts` — reactive `boolean` from `navigator.onLine` + `online`/`offline` events.
- `hooks/useSyncStatus.ts` — reactive `{ pending, status, flush }` from `syncService` CustomEvents.
- `components/shell/OfflineBanner.tsx` — contextual banner: offline (queued count), syncing (progress), error (tap to retry), hidden when idle online.
- `main.tsx` — `syncService.init()` called on bootstrap; `SYNC_COMPLETE_EVENT` listener invalidates session + client queries after successful flush.

### Changed
- `useLogSet`, `useAddExercise`, `useAddWorkout`, `useEndSession` mutations now use `offlineAwareApi` — all critical session writes are offline-tolerant.
- `Layout.tsx` — `OfflineBanner` mounted above main content; `pendingSyncCount` wired to real `useSyncStatus` value (was hardcoded 0).

### Offline scenario covered
Trainer opens app on gym WiFi → prefetch runs (clients, sessions, exercises cached) → WiFi drops → trainer completes all 5 sessions, logging sets throughout → writes queue locally → WiFi restored → queue flushes automatically → queries invalidated → UI reflects synced state. App open required for sync (background sync deferred to IndexedDB upgrade).

---

## [v2.3.0] — Nav Event Bus

### Added
- `services/navEventBus.ts` — internal event bus mirroring RxJS Subject API (`.next()`, `.subscribe()`, `.getValue()`). Debounces rapid navigation per action (300ms panel opens, 150ms close, 200ms tab switches). In-memory audit log capped at 200 entries. Full RxJS swap deferred to v3.1.0 — replace this file only.
- `hooks/useNavLog.ts` — subscribe to nav events or read the audit log from any component.
- `services/navService.ts` — every navigation call now emits through `navEventBus` before executing React Router navigate.

### Fixed
- Exercise search in `AddExerciseSheet` pre-filters by the block's workout type (cardio block → cardio exercises). "All types" chip to override.
- `WorkoutBlock` — "New Block" button added alongside "Add Exercise" so multiple blocks per session is discoverable. FAB labelled "Add Block" (was unlabelled `+`).

---

## [v2.2.0] — Sessions View

### Added
- `SessionsPage` — full rebuild with sticky header, search, status tabs (All / Planned / Active / Done), client filter chips (trainer mode). Sessions grouped by date label. Context-aware cards: planned shows Edit + Start, active shows Resume, completed is tappable.
- `SessionHistoryPanel` — slide-in detail view: stats row (duration, sets, volume), exercise breakdown with per-set hit/miss vs targets, subjective scores, notes.
- `AppShell` — `sessionHistory` panel wired.

### Fixed
- `SessionCard` outer element changed from `<button>` to `<div role="button">` — fixes nested button DOM warning.
- `handleResume` registers session in `activeSessions` store before expanding overlay — fixes Resume doing nothing when store was cleared.
- `EndSessionModal` — `hasWork` prop added. Empty sessions (no logged sets) show "Discard / End Anyway" instead of the score sliders.
- `SessionPlanPanel` — "Save Plan" button added. Plan saves automatically on first block add; "not saved yet / saved" indicator in subheading. Empty state copy clarified.

---

## [v2.1.0] — Session Planning

### Added
- `sessionStore` extended with `plannedSessions: Record<sessionId, PlannedSession>` alongside `activeSessions`.
- `usePlannedSessions`, `useExecuteSession`, `useUpdateSessionName`, `useDiscardSession` query hooks.
- `SessionPlanPanel` — plan builder: lazy DB creation (on first block add), client selector, session naming, workout blocks via existing `WorkoutBlock`/`AddBlockSheet`, Execute button transitions `planned → in_progress` and expands overlay, Discard with confirm.
- `SessionLauncherSheet` — session launcher as a `BottomSheet`, replaces `/session/new` page for SPA flow.
- `navService` — `openSessionPlan` added, `sessionPlan` panel type added.
- `SessionsPage` — initial planned sessions view + recent completed sessions list.
- `AppShell` — `SessionPlanPanel` and `SessionLauncherSheet` wired.
- `DELETE /sessions/:id` backend route — hard deletes session + all children via CASCADE. Trainer-scoped.

### Fixed (hotfix)
- `AddExerciseSheet` / `ExerciseBlock` — workout-type-aware target inputs and set logging. Resistance: Sets × Reps × Weight. Cardio: Rounds + Distance/Time/Intensity picker. Calisthenics: Sets × Reps or Sets × Time toggle. Stretching: Sets × Hold time. Cooldown: Duration only.
- `LiveSessionContent` — discard flow via `⋯` menu in header (inline confirm, no modal). Discards session, clears store, hides overlay.
- `EndSessionModal` — `hasWork` prop; empty sessions offer Discard/End Anyway.

---

## [v2.0.0] — SPA Refactor

### Added
- `services/navService.ts` — all navigation through `useNav()`. React Router now, RxJS-ready.
- `store/overlayStore.ts` — overlay UI state: `hidden / minimised / expanded`.
- `components/shell/LiveSessionContent.tsx` — session UI extracted from page, used by overlay + page.
- `components/shell/ActiveSessionOverlay.tsx` — Spotify-model persistent overlay. Auto-expands on session start, swipe-down to minimise, animated pill above nav, live elapsed timer, multi-session switcher.
- `components/shell/ClientProfilePanel.tsx` — client profile as slide-in panel.
- `components/shell/AppShell.tsx` — SPA root: reads `location.state` for panel open/close, mounts all panels + overlay.
- `ClientCard`, `ClientsPage` — converted from `<Link>` to `useNav().openClientProfile()`.
- `Layout.tsx` — bottom nav hides on overlay expand.
- `LiveSessionPage` — thin wrapper delegating to `LiveSessionContent`, auto-expands overlay.
- `SessionLauncherPage` — calls `expand() + navigate(-1)` instead of routing to `/session/:id`.



### Added
- `BottomSheet` component — mobile-first slide-up overlay with backdrop, drag handle, Escape key dismiss, body scroll lock
- `DragStepper` component — drag up/down number input with ▲/▼ buttons. 8px per step, linear feel (no acceleration). Works on both touch and mouse. Keyboard arrow key support. Range 1–30 reps, 1–10 sets.
- `AddBlockSheet` — bottom sheet to pick workout type (resistance / cardio / calisthenics / stretching / cooldown) and create a block instantly
- `AddExerciseSheet` — bottom sheet with live search, exercise list, quick-add draft, and target sets/reps steppers
- `WorkoutBlock` — "Add Exercise" dashed button at bottom of each block opens `AddExerciseSheet`
- `LiveSessionPage` — empty state replaced with "Add Block" CTA; FAB `+` button shown when blocks exist; `AddBlockSheet` wired

### Quick-add exercise
When search finds no match, "Create as draft" creates an `isDraft: true` exercise with the block's workout type, adds it to the block immediately. Post-session enrichment deferred — see `DEFERRED_ITEMS.md`.

### Deferred
- Post-session wrap-up (name drafts, add notes, preview next session) — `DEFERRED_ITEMS.md`
- Draft exercise enrichment queue — `DEFERRED_ITEMS.md`

---

## [v1.7.5] — Redis + BullMQ (Scheduled Reports + At-Risk Alerts)

### Added
- `bullmq ^5.4.0` + `ioredis ^5.3.2` added to backend dependencies
- `queues/connection.ts` — singleton Upstash Redis connection (TLS, BullMQ-compatible)
- `queues/index.ts` — queue definitions (`reports`, `alerts`) + job data types
- `queues/scheduler.ts` — hourly fanout workers that filter by trainer timezone (08:00 local). Reports only fire on the 1st of the trainer's local month.
- `queues/workers.ts` — `startReportWorker()` (concurrency 3) and `startAlertWorker()` (concurrency 5) with graceful shutdown
- `services/alert.service.ts` — at-risk digest email builder + Resend sender. Neutral/clinical tone always. Table-based inline-style HTML.
- `timezone` column on trainers table — IANA string, default `'UTC'`
- `autoReportEnabled` column on trainers table — master switch, default `true`
- `autoReport` column on clients table — per-client opt-in, default `true`
- Queue starts conditionally — no `UPSTASH_REDIS_URL` = queue disabled with warning (dev-friendly)
- Graceful shutdown on `SIGTERM`/`SIGINT` — drains workers before exit
- `PreferencesPage` — auto-report toggle + timezone selector (17 common IANA zones)
- `ClientForm` — auto-report toggle in KPI Settings section
- `UPSTASH_REDIS_URL` added to `.env.example`

### At-risk alert logic
- Runs daily at 08:00 trainer local time
- Finds clients with no session in 14+ days (never trained = also at-risk)
- One digest email per trainer listing all at-risk clients, color-coded red (21+ days) or amber (14–20 days)
- Only sent if trainer has `alertsEnabled: true`
- Deduplicated by `jobId` — one alert per trainer per day

### Scheduled report logic
- Runs on 1st of month at 08:00 trainer local time
- Skips clients with no email, no sessions in period, or `autoReport: false`
- Skips all clients if trainer `autoReportEnabled: false`
- Deduplicated by `jobId` — one report per client per calendar month

---

## [v1.7.0] — Monthly Reports

### Added
- `services/report.service.ts` — HTML email builder (table-based, inline styles, email-client safe) + `sendReport()` via Resend + `resolveReportPeriod()` with calendar-month / rolling-30 fallback logic
- `routes/reports.ts` — `GET /clients/:id/report-preview` (returns HTML + metadata) and `POST /clients/:id/report` (sends via Resend, increments `reportsSentCount`)
- `ReportPreviewModal` — live HTML preview in an iframe, blurb textarea with pulsing amber border until focused, Send button disabled when no sessions or no client email
- `useReportPreview` + `useSendReport` query hooks
- Send Report button on client profile header — disabled with "No Sessions" label when `sessionsThisMonth === 0`
- `sessionsThisMonth` field added to `ClientKpiResponse` schema and KPI route
- `resend ^3.2.0` added to backend dependencies
- `RESEND_API_KEY` + `REPORT_FROM_EMAIL` added to `.env.example`
- `pulse-border-amber` animation keyframe added to Tailwind config
- SMS delivery deferred to Phase 7.5 — added to `DEFERRED_ITEMS.md`

### Report structure
1. Header — client name, period label
2. Highlights — sessions count + consistency %, volume, goals achieved
3. Performance — focus KPI label (if available)
4. Sessions table — date, name, sets, volume, energy (max 8 rows + overflow count)
5. How you felt — energy + stress score bars
6. Goals achieved — green highlighted section (if any)
7. Looking ahead — active goals
8. Trainer note — amber highlighted section (if blurb entered)
9. Footer — trainer name

---

## [v1.6.1] — Cleanup: serializeTrainer + ClientProfilePage split

### Refactored
- `apps/backend/src/routes/auth.ts` — extracted `serializeTrainer()` pure function. Six identical inline trainer response objects replaced with one call each. Adding a new trainer field is now a single-line change in one place.
- `apps/frontend/src/pages/ClientProfilePage.tsx` — reduced from 875 lines to 248. Now orchestration-only: routing, state, data fetching, header, tab bar. All tab content extracted to dedicated components.
- `apps/frontend/src/components/client-profile/OverviewTab.tsx` — extracted. Contains: StatCard, GoalRow, goal CRUD, focus display, progression state.
- `apps/frontend/src/components/client-profile/TimelineTab.tsx` — extracted. Contains: unified timeline, session tap navigation, scroll save.
- `apps/frontend/src/components/client-profile/BaselineTab.tsx` — extracted. Contains: SnapshotCard, snapshot history, take snapshot CTA.

### Fixed
- `apps/backend/src/__tests__/helpers/factories.ts` — `makeTrainer` and `makeClient` now include `weeklySessionTarget` and `show1rmEstimate`
- `apps/backend/src/routes/kpis.ts` — `top[1]!` non-null assertion to fix `noUncheckedIndexedAccess` error

---

## [v1.6.0] — KPI Dashboard

### Added
- `GET /clients/:id/kpis` backend route — computes all 8 KPI cards server-side (single source of truth for reports)
- `ClientKpiResponseSchema` + `FocusKpiSchema` in shared — discriminated union per focus type (resistance / calisthenics / cardio / mixed / insufficient_data)
- `KpiCard` component — stat card with label, value, context line, trend arrow (up/down/flat), highlight mode for at-risk cards
- `KpiCarousel` component — 4-card visible window, snap scroll, dot navigation, desktop prev/next arrows
- `KpiHero` component — translates `ClientKpiResponse` into 8 `KpiCardData` cards, renders carousel + 1RM tip nudge
- `TipIcon` component — flexed bicep SVG with `!` badge, reusable tip indicator across the app
- KPI hero section added above tabs on every client profile page
- `weeklySessionTarget` + `show1rmEstimate` on `trainers` table (athlete preferences)
- `weeklySessionTarget` + `show1rmEstimate` on `clients` table (per-client, trainer configures)
- Weekly session target stepper + 1RM toggle in `PreferencesPage` dashboard section (athlete mode)
- Weekly session target stepper + 1RM toggle in `ClientForm` KPI Settings section (edit mode only)
- `useClientKpis(clientId)` query hook — 5 min stale time, no retry on 404
- 1RM tip nudge in KpiHero — shown once to athletes when sessions exist, tracked in localStorage, dismissable

### KPI Cards (in order)
1. Streak — current + best consecutive weeks
2. This week — `X/target` sessions
3. Last session — days ago + date
4. Focus KPI — resistance: top lift + vol trend; cardio: distance + pace; calisthenics: max reps; mixed: volume
5. Volume this month — lbs
6. All time — total completed sessions
7. Avg energy — 1–10 this month
8. Avg stress — 1–10 this month (highlights ≥7)

---

## [v1.5.1] — Session History + Client Timeline

### Added
- `SessionHistoryPage` (`/session/:id/history`) — summary layout for reviewing past sessions: stats row (sets, volume, duration), flat exercise list with sets as pills (amber = missed target), subjective scores, session notes
- `useScrollRestoration(key)` hook — saves `window.scrollY` to sessionStorage before navigation
- `useRestoreScroll()` hook — reads `location.state.scrollKey` on mount, restores scroll after `requestAnimationFrame`
- `TimelineTab` in `ClientProfilePage` — sessions added to unified chronological timeline alongside goals and snapshots
- Session timeline cards — tappable, navigate to `/session/:id/history` with `saveScroll()` before leaving
- Color-coded timeline dots by event type: brand highlight = session, emerald = goal, sky = snapshot. `data-type` attribute on each entry for future filter-by-type feature
- `useRestoreScroll()` called in `ClientProfilePage` — exact pixel scroll restored on return from history
- Slide transition on `SessionHistoryPage` — `animate-slide-in-right` on enter, back button returns left
- `/session/:id/history` route registered in `App.tsx`

### Fixed
- Removed duplicate `cn as cx` import from `ClientProfilePage`
- `useSessions` query hook now imported and used in `TimelineTab`

---

## [v1.5.0] — Session Logging

### Added
- `SessionLauncherPage` (`/session/new`) — blank start or template picker, client selector for trainer mode
- `LiveSessionPage` (`/session/:id`) — active workout screen with horizontal/vertical layout toggle
- `SessionSummaryPage` (`/session/:id/summary`) — post-session stats, subjective scores, nav home
- `SetRow` components — three accordion states: past (color-coded vs target), active (large inputs), future (placeholder)
- `ExerciseBlock` — exercise with full set accordion. Defaults: 3 sets, 10/8/6 reps for blank sessions
- `WorkoutBlock` — workout block container, supports both layout modes
- `RestTimerBanner` — fixed top banner during rest. Depleting bar, number flip per tick, amber ≤10s, red pulse ≤3s, Skip button
- `EndSessionModal` — 3 sliders (energy, mobility, stress 1–10) + optional session note
- `useRestTimer` hook — countdown with `rest_tick` / `rest_complete` UX events, haptic vibration on mobile
- `lib/queries/sessions.ts` — full session lifecycle query hooks
- `lib/queries/templates.ts` — template list and detail hooks
- `sessionLayout` preference (`horizontal` | `vertical`) — stored on trainer record, toggle in Preferences screen
- Session layout toggle in Preferences → Dashboard section
- `db:push` script — `pnpm db:push` for development schema changes without migration files
- `release.sh` — one-command git commit + tag + push
- Storybook stories for all session components

### Fixed
- `sessions.ts` — `POST /sessions` and `PATCH /sessions/:id` now serialize `Date` objects to ISO strings and include `client` object in response
- `sessions.ts` — `startTime` / `endTime` properly converted to `Date` before Drizzle insert/update
- `media.ts` — null guard added after `.returning()` on upload
- `exercises.test.ts` — `makeExercise` factory now uses `new Date()` for `createdAt`/`updatedAt`
- `PreferencesPage.tsx` — missing `<div>` wrapper around widget order section causing JSX parse error

---

## [v1.4.5] — Preferences Screen

### Added
- `PreferencesPage` (`/preferences`) — Profile, Training Mode, Dashboard, Alerts sections
- CTA label picker — 8 options, saves immediately on select
- Widget order — draggable list with hamburger handle, live reorder
- Session layout toggle (horizontal / vertical)
- Alert color scheme picker — amber, red, blue, green
- Alert tone picker — clinical, motivating, firm
- `useReorderList` hook — pointer-event drag-to-reorder, no external library
- `alertColorScheme` and `alertTone` preference fields on trainer record
- Preferences link in sidebar user badge area (desktop)
- Gear icon in mobile bottom nav

### Fixed
- `auth.ts` — `preHandler: [authenticate]` added to `POST /auth/onboard` and `PATCH /auth/me`

---

## [v1.4.4] — UX Event System

### Added
- `lib/ux-events.ts` — 33-type `UXEventType` taxonomy, animation engine, side-effect registry, contextual guidance rules
- `hooks/useUXEvent.ts` — `fire()` hook, `useUXEventRef()` helper
- New keyframes: `flash-success`, `flash-warning`, `collapse-out`, `celebrate`, `field-confirm`, `pulse-sharp`, `lift`, `slide-out-left/right`
- Storybook — `UXEvents.stories.tsx` with interactive demos

### Wired
- `AddClientCard` → `single_press`
- `ClientDrawer` → `create` / `update` on success
- `ClientProfilePage` GoalRow → `achieve`
- `DashboardPage` → `page_enter` on mount

---

## [v1.4.3] — Storybook Pass

### Added
- Stories: `SilhouetteAvatar`, `ClientCard`, `AddClientCard`
- Stories: all 5 dashboard widgets, full trainer and athlete stacks
- Stories: `Interactions` — all animation classes and keyframes

---

## [v1.4.2] — Dashboard

### Added
- `DashboardPage` — branches on `trainerMode`, time-of-day greeting, staggered widget animation
- `AtRiskWidget` — dismissable alert, 4 color schemes, 3 message tones
- `SelfTrainingWidget` — self-client tile, CTA from preferences
- `ActiveClientsWidget` — count with progression state bars
- `GoalsWidget` — active goal count, achievements this month
- `RecentSessionsWidget` — Phase 5 placeholder skeleton
- `WidgetRenderer` — maps `WidgetId` → component

---

## [v1.4.1] — Preference Schema Patch

### Added
- Trainer schema: `cta_label`, `alerts_enabled`, `widget_progression`
- `lib/widgets.ts` — widget registry, parse/serialize, default orders per mode, `CTA_LABEL_OPTIONS`
- `hooks/usePreferences.ts` — clean preference access hook with `updatePreference()` and `updateWidgetOrder()`

---

## [v1.4.0] — Phase 4: Client Management + Onboarding

### Added
- `OnboardingPage` — mode selection (athlete / trainer), fires `POST /auth/onboard`
- `OnboardingGate` — redirects unonboarded trainers to `/onboard`
- `ClientsPage` — roster with self-client tile, trainer/athlete mode branching, Add Client card
- `ClientProfilePage` — 3 tabs (Overview, Timeline, Baseline) with incomplete indicators
- Goal list — ordered, achievable, deletable
- Snapshot history with delta vs baseline
- `SilhouetteAvatar`, `ClientCard`, `AddClientCard` with pulsing `+` badge
- `ClientDrawer` — context-aware add/edit
- `lib/queries/clients.ts` — full client, goal, snapshot query hooks
- `lib/interactions.ts` — animation config in one place
- `/clients/:id` route

---

## [v1.3.1] — Phase 3D: Usage Metrics + Onboarding Schema

### Added
- Trainer schema: `trainer_mode`, `reports_sent_count`, `last_active_at`
- Client schema: `last_active_at`
- New table: `trainer_usage_monthly` — billing meter
- `TrainerModeEnum` (athlete | trainer)
- `POST /auth/onboard` — sets `trainerMode` and `onboardedAt`
- `PATCH /auth/me` — updates trainer profile and preferences

---

## [v1.3.0] — Phase 3C: Client Goals, Snapshots, Self-Training

### Added
- Client schema: `primaryFocus`, `secondaryFocus`, `progressionState`, `startDate`, `caloricGoal`, `isSelf`
- New tables: `client_goals`, `client_snapshots`
- Session schema: `energyLevel`, `mobilityFeel`, `stressLevel`, `sessionNotes`
- Routes: full CRUD for client goals and snapshots
- `GET /clients/self` — returns trainer's self-client
- `isSelf` guard — blocks deletion of self-client
- Auto-creates self-client on trainer registration

---

## [v1.2.1] — Phase 3.5: Storybook Component Library

### Added
- Storybook setup with all UI components: Button, Input, Select, TextArea, Badge, Spinner, Modal, Drawer, ConfirmDialog, EmptyState

---

## [v1.2.0] — Phase 3: Exercise Library

### Added
- Exercise library UI with search, filter by body part/type/equipment
- Cloudinary media upload (images and video)
- Body parts seeding
- Exercise detail drawer

---

## [v1.1.1] — Phase 2b: Unit Tests

### Added
- 120 Vitest unit tests across auth service, middleware, and all routes

---

## [v1.1.0] — Phase 2: Authentication

### Added
- JWT access tokens + httpOnly refresh token cookies
- argon2 password hashing
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `authenticate` middleware
- Device ID tracking

---

## [v1.0.0] — Phase 1: Scaffold

### Added
- pnpm monorepo: `apps/frontend`, `apps/backend`, `packages/shared`
- Fastify + Drizzle ORM + PostgreSQL backend
- React + Vite + Tailwind + TanStack Query frontend
- Full DB schema: trainers, clients, exercises, sessions, workouts, sets, templates, sync log
- Swagger/OpenAPI documentation at `/documentation`
- GitHub Actions CI: typecheck, lint, test, build

## [v2.5.0] — UI/UX Polish + Gamification Foundations

### Session execution layout
- `WorkoutBlock` redesigned for execution mode: exercises navigate horizontally (snap-scroll + tappable peeks), two-row dot system (block position + exercise position within block), carved footer bar (Add exercise | New block), rest timer replaces footer temporarily after set log
- PR flash sequence: amber overlay on log (1.5s) fades to persistent chip on set row (`1RM` or `Vol` pill, amber/highlight)
- Overview mode (plan builder) unchanged — vertical exercise list

### PR system
- `sets` table: `isPR boolean` + `isPRVolume boolean` columns, detected at log time
- Backend: Epley 1RM formula (`weight × (1 + reps/30)`) compared against historical max for client+exercise; volume (`weight × reps`) tracked separately
- `prNotifyType` preference (`1rm` / `volume` / `both`) added to trainer schema + PreferencesPage
- Session history: PR filter toggle ("PRs only") on SessionHistoryPanel; `1RM` and `Vol` chips inline on set rows
- Personal Bests: `GET /clients/:id/personal-bests` endpoint; `PersonalBestsTab` component; new "PRs" tab on client profile (panel + page); ⓘ tooltips on metrics

### Gamification foundations
- `consistencyScore` added to `ClientKpiResponseSchema` and computed in KPI route (rolling 4-week score 0–100)
- Consistency score card added to KpiHero carousel
- `currentStreakWeeks` + `bestStreakWeeks` already computed; now displayed alongside consistency

### Code quality — DRY pass
- `lib/exerciseLabels.ts` — WORKOUT_TYPE_BADGE_VARIANT, WORKOUT_TYPE_LABEL, WORKOUT_TYPE_COLOR, EQUIPMENT_LABEL, DIFFICULTY_COLOR, DIFFICULTY_TEXT_COLOR. Removed local copies from ExerciseCard, ExerciseDetailPanel, ExerciseDetail
- `lib/formatters.ts` — formatDate, formatDuration, formatElapsed, formatEpley, formatVolume, formatSetSummary, formatTotalVolume, formatSeconds. Removed local copies from SessionsPage, SessionHistoryPage, SessionHistoryPanel

### Developer experience
- `CONTRIBUTING.md` — checklist for new column additions (schema, serializer, response schema, test factory, backfill SQL)
- `serializeTrainer()` and `factories.ts` annotated with CONTRIBUTING.md reference


## [v2.6.0] — ESLint

### Added
- `packages/eslint-config/` — shared ESLint 9 flat config base. Rules: `@typescript-eslint/recommended`, `no-explicit-any` warn, `no-unused-vars` error with `_` prefix escape, `no-console` warn, `eqeqeq`, `prefer-const`, `no-var`.
- `apps/frontend/eslint.config.js` — extends base + `eslint-plugin-react` + `eslint-plugin-react-hooks`. `rules-of-hooks` error, `exhaustive-deps` warn. Stories/tests relaxed.
- `apps/backend/eslint.config.js` — extends base. `no-console` off (pino wraps it). Tests/seeds relaxed.

### Changed
- `apps/frontend/package.json` — `lint` script wired to `eslint . --max-warnings 0`
- `apps/backend/package.json` — same
- `pnpm lint` at root now runs all three packages via `pnpm -r lint`


## [v2.7.0] — Template Library

### Backend
- `POST /sessions` with `templateId` — now actually copies template workout blocks and exercises into the new session (was previously a no-op)
- `POST /templates/:id/fork` — deep copies a template with all blocks and exercises
- `POST /templates/:id/workouts` — add a workout block to a template
- `DELETE /template-workouts/:id` — remove a workout block
- `POST /template-workouts/:id/exercises` — add an exercise to a template block
- `DELETE /template-exercises/:id` — remove an exercise from a block
- `seedDefaultTemplates(trainerId)` — 20 curated default templates seeded on new trainer registration: Push Day A/B, Pull Day A/B, Leg Day A/B, Upper Body, Lower Body, Full Body A/B, PPL Push/Pull/Legs, HIIT Circuit, Steady State Cardio, Cardio + Core, Full Body Stretch, Post-Leg Recovery, Upper Body Mobility

### Frontend
- `TemplatesPage` — full template library with search, card grid, fork/edit/delete
- `TemplateBuilderSheet` — create and edit template name/description; shows workout blocks in read-only overview
- `TemplatePickerSheet` — pick a template to load into a session plan
- `SessionPlanPanel` — "Load template" button creates a session pre-populated from template; "Save as template" saves the current plan as a new template
- `lib/queries/templates.ts` — expanded with `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useForkTemplate`


## [v2.7.0] — Template Library (final)

### Backend
- `GET /templates?search=` — server-side ILIKE search across name, description, notes, and exercise names (EXISTS subquery)
- `POST /auth/seed-templates` — seeds 20 default templates for logged-in trainer; idempotent per-name
- `POST /auth/logout` — revokes refresh token; frontend now calls this on logout
- Template detail query — added `media: true` to exercise join (was causing ResponseValidationError)
- Default template seed — changed all-or-nothing check to per-name so existing trainers get defaults seeded alongside their own templates

### Frontend
- `TemplatesPage` — server-side debounced search (300ms), active search breadcrumb chip with result count, auto-seeds defaults on mount
- `TemplateBuilderSheet` — full block builder: add blocks by type, add exercises via `TemplateExercisePickerSheet`
- `TemplateExercisePickerSheet` — searchable exercise picker for template blocks
- `SessionPlanPanel` — "Add exercise block" + "Load session template" buttons in empty state; template picker no longer gated behind `sessionId`
- `Layout` — fixed sidebar (viewport height, never grows with content); athlete mode shows "My Training" nav; logout button with `qc.clear()` + `clearAuth()`
- `LoginPage` — `qc.clear()` on login to flush stale cache from previous session
- `MyTrainingPage` — resolves self-client via `GET /clients/self` then redirects; avoids stale ID cache issue
- `App.tsx` — `/my-training` route registered
- `docs/` folder — all markdown docs moved from root; README updated with table of links

### Bug fixes
- Auth loop — `window.location.href` replaced with `clearAuth()` + React Router redirect
- Template `GET :id` — added `media: true` to exercise join
- TanStack Query cache — cleared on login and logout to prevent stale cross-session data
- Sidebar height — `md:fixed md:inset-y-0` so content scrolls independently


## [v2.8.0] — Auto-populate + Drag Reorder + Post-session Wrap-up

### Backend
- `GET /clients/:id/exercise-history/:exerciseId` — returns last session's sets for any exercise; used by live session UI to pre-fill inputs
- `PATCH /sessions/:id/workouts/reorder` — persist new workout block order after drag
- `PATCH /workouts/:workoutId/exercises/reorder` — persist new exercise order after drag

### Frontend
- **Auto-populate from history** — live session inputs now pre-fill with last session's weight/reps for each set. Priority: target → last session set → empty. `ExerciseBlock` and `WorkoutBlock` now accept `clientId` and fetch history via `useExerciseHistory`
- **Drag-to-reorder** — `SortableWorkoutList` component using `@dnd-kit/sortable`. Drag handles appear on workout blocks in plan builder. Order persists to backend on drop
- **Post-session wrap-up** — `PostSessionWrapUp` sheet shown after ending a session. Displays: exercises completed, sets logged, total volume, PR count with exercise callouts. Lets trainer name/rename the session before navigating to summary


## [v2.8.x hotfixes] — Post-hosting fixes

### Bug fixes
- `SelfTrainingWidget` — profile link changed from `/clients/${selfClient.id}` to `/my-training`; fixes "Client not found" in athlete mode on dashboard
- `api.ts` — `redirectToLogin()` now excluded for `/auth/` routes; fixes blank error message on login failure
- `LoginPage` — added explicit JS validation before submit; fixes no error shown on empty fields in installed PWA (iOS bypasses HTML5 `required`)
- `POST /auth/register` — added rate limit (5 attempts / 15 minutes); was previously unlimited
- `POST /auth/login` — temporary debug logs removed
- `verifyPassword` — temporary debug logs removed

### Exercise data
- `exercises-library.json` — renamed `Dumbbell Fly` → `Dumbbell Flye`
- `exercises-library.json` — added `Incline Dumbbell Flye` to isolation chest exercises
- `defaultTemplates.ts` — updated `Incline Dumbbell Fly` → `Incline Dumbbell Flye` in two templates
- SQL fix instructions added to `docs/SQL_COMMANDS.md` for production DB duplicate cleanup

### Hosting
- `vercel.json` — updated for `apps/frontend` root directory deployment; `buildCommand` uses `cd ../..` to reach monorepo root
- `railway.json` — healthcheck timeout tuned; host binding fixed (`0.0.0.0` default)
- `packages/shared` — `prepare` script auto-compiles shared to CJS on `pnpm install`; `main` points to `dist/index.js`
- `packages/shared/tsconfig.build.json` — added for CJS compilation
- `pnpm.overrides` — `zod` hoisted to root; `workbox-build` pinned to avoid `assignWith` bug
- `.npmrc` — `hoist-pattern[]=zod` added

### Docs added
- `docs/RAILWAY_ERRORS.md` — full error log from Railway deploy debugging
- `docs/SECURITY.md` — security assessment across all 6 areas
- `PWA_DEBUG_GUIDE.md` — PWA debugging guide (kept outside version control)
- `docs/SQL_COMMANDS.md` — production DB exercise fix queries added

### PWA icons
- `public/icons/` — all 8 required sizes generated (72–512px)
- `public/generate-icons.html` — browser tool for regenerating emoji icons locally


## [v2.10.0] — Template Builder UX

### Backend
- `PATCH /templates/:id/workouts/reorder` — accepts ordered array of template workout IDs, updates `orderIndex` values. Same pattern as session workout reorder. Trainer-scoped with ownership verification.

### Frontend

**Feature 1 — Filter exercises by workout type in template picker:**
- `TemplateExercisePickerSheet` now receives `workoutType` from the parent block
- Exercise list pre-filtered to match block type (resistance block → resistance exercises only)
- "All types" chip to override the filter — same UX as `AddExerciseSheet`
- Empty state: "No exercises found for {type}" when no matches

**Feature 2 — Delete block + drag reorder blocks:**
- `TemplateBlockCard` — trash icon at top-right of each block card; removes block + exercises via `DELETE /template-workouts/:id`
- `SortableBlockList` — `@dnd-kit/sortable` wraps block list in `DndContext + SortableContext`; 6-dot drag handle on each block (same pattern as `SortableWorkoutList` in session plan); optimistic reorder on drop, persisted via `PATCH /templates/:id/workouts/reorder`
- `useDeleteTemplateWorkout` + `useReorderTemplateWorkouts` query hooks added to `lib/queries/templates.ts`

**Feature 3 — Exercise accordion + swipe to add:**
- `ExerciseAccordionRow` — new shared component (`components/exercises/ExerciseAccordionRow.tsx`):
  - Collapsed: exercise name + body part tag + difficulty badge + chevron
  - Expanded: lazy-loads exercise detail (description, instructions, equipment/type tags), smooth height animation
  - Only one accordion open at a time (parent controls `expandedId`)
  - Swipe-right gesture (~80px threshold) to add exercise immediately; green flash confirms
  - "Add to block" button inside accordion (belt and suspenders with swipe)
  - Optional `renderActions` prop for custom action buttons (used by `AddExerciseSheet` for "Quick add" + "Set targets →" dual buttons)
- `TemplateExercisePickerSheet` — exercise list uses `ExerciseAccordionRow` with swipe enabled
- `AddExerciseSheet` — exercise list uses `ExerciseAccordionRow` with swipe (quick-add with defaults) + "Set targets →" for full target config flow
- `ExercisesPage` — no change; grid + BottomSheet detail already provides equivalent UX for browse-only context


## [v2.11.0] — Session + Exercise Detail UX

### Session overlay — desktop sidebar offset
- `ActiveSessionOverlay` — expanded overlay now uses `md:left-56` to sit alongside the desktop sidebar instead of hiding behind it. Minimised pill also offset on desktop.

### Exercise detail — hide empty media
- `ExerciseHero` — returns nothing when no visualization or demonstration exists. Removes the "Visual coming in Phase 9" placeholder that took up space for every exercise.

### Exercise detail — single scroll
- `ExercisesPage` — removed nested `overflow-y-auto` wrapper around `ExerciseDetailPanel` inside the BottomSheet. The BottomSheet already has its own scroll container — the extra wrapper caused double-scroll UX on mobile.
