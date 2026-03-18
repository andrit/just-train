# Changelog

All notable changes to TrainerApp are documented here.
Versions follow [Semantic Versioning](https://semver.org/).

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
