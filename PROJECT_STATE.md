# TrainerApp — Project State Document

> **Last updated:** v1.7.5
> **Purpose:** Living reference for architecture decisions, design principles, progress, and direction.
> Updated at the end of every versioned release. Review this at the start of each new phase.

---

## Product Vision

**TrainerApp is a progress narrative engine. Logging is just the input.**

Every screen answers: *"Is this client moving forward?"*

```
Capture → Compare → Communicate
```

The app serves two user types with one shared infrastructure:
- **Trainer mode** — manages a client roster, delivers monthly reports, tracks own training as a secondary feature
- **Athlete mode** — tracks own training only, no client roster, simplified interface

Both modes share identical backend logic. The difference is entirely in what the frontend shows.

---

## Locked Design Decisions

These decisions have been made and should not be revisited without a strong reason.

### Terminology
| Concept | Term | Why |
|---|---|---|
| Full training event | **Session** | |
| Grouped block of exercises | **Workout** | |
| Individual movement | **Exercise** | |
| Single logged effort | **Set** | |

### Data model principles
- **Goals are a history table** — goals shift over time, never deleted, full arc narrative in reports
- **Snapshots are time-series** — one per rhythm (per-session subjective, monthly body comp, phase transition)
- **Sets store their own weight unit** — historical records stay accurate if trainer switches lbs/kg
- **isSelf client** — every trainer gets one auto-created at registration. All session/snapshot/goal routes work identically for it. This is the foundation of both self-training and athlete mode.
- **widgetProgression stored as comma-delimited text** — never queried inside, only read/written whole. Split to array in JS.

### SaaS model
- `trainerMode` and `subscriptionTier` are **orthogonal** — mode determines product experience, tier determines feature level and price
- Both modes can be free or paid
- `studio` tier is trainer-only
- Primary billing metric: **active clients per month** (clients with ≥1 completed session in rolling 30 days)
- Billing gates are documented but **not yet enforced** — see `DEFERRED_ITEMS.md`

### Security
- Access tokens: JWT, 15 min TTL, in-memory only (Zustand, never localStorage)
- Refresh tokens: opaque random string, 7-day TTL, httpOnly cookie only
- Passwords: argon2id
- Device tracking via `X-Device-ID` header

### Frontend principles
- **`exactOptionalPropertyTypes: false`** on both frontend and backend tsconfig — Drizzle and optional props produce `undefined`, not `null`
- **`noUncheckedIndexedAccess: false`** on frontend — too noisy for UI code
- All server state via TanStack Query. All client state via Zustand.
- Components never call `apiClient` directly — they use query hooks from `lib/queries/`
- All animation values in `lib/interactions.ts` — one place to tweak
- UX events in `lib/ux-events.ts` — semantic layer above CSS animations

---

## Architecture

### Monorepo structure
```
trainer-app/
├── packages/shared/          # Zod schemas, enums, types, utilities
│   └── src/
│       ├── enums/            # All Zod enums
│       ├── schemas/          # Input + response schemas
│       ├── types/            # TypeScript interfaces
│       └── utils/            # weight.ts
├── apps/backend/             # Fastify API
│   └── src/
│       ├── db/schema/        # Drizzle table definitions (one file per domain)
│       ├── db/index.ts       # DB client + table exports
│       ├── middleware/       # authenticate, requireRole
│       ├── routes/           # One file per resource
│       └── services/         # auth.service.ts
└── apps/frontend/            # React PWA
    └── src/
        ├── components/       # Organized by domain (clients/, dashboard/, session/, ui/)
        ├── hooks/            # usePreferences, useUXEvent, useRestTimer, useReorderList
        ├── lib/              # api.ts, queries/, interactions.ts, ux-events.ts, widgets.ts
        ├── pages/            # One file per route
        └── store/            # authStore.ts, sessionStore.ts
```

### Key files to know
| File | Purpose |
|---|---|
| `packages/shared/src/enums/index.ts` | Single source of truth for all enum values |
| `packages/shared/src/schemas/response-schemas.ts` | All API response shapes |
| `apps/backend/src/db/schema/trainers.ts` | Trainers + clients tables, all enums |
| `apps/backend/src/routes/auth.ts` | Register, login, refresh, logout, onboard, patch me |
| `apps/frontend/src/lib/interactions.ts` | All animation CSS class values |
| `apps/frontend/src/lib/ux-events.ts` | UX event taxonomy + animation engine + side-effect registry |
| `apps/frontend/src/lib/widgets.ts` | Widget registry, default orders, CTA label options |
| `apps/frontend/src/hooks/usePreferences.ts` | Clean access to all trainer preferences |
| `DEFERRED_ITEMS.md` | Everything intentionally deferred, with "when to revisit" notes |
| `CHANGELOG.md` | Full version history |

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS | |
| State | TanStack Query (server), Zustand (client) | |
| PWA | vite-plugin-pwa, Workbox | Phase 8 |
| Offline | IndexedDB + sync log table | Phase 8 |
| Backend | Fastify 4, TypeScript | |
| ORM | Drizzle ORM + drizzle-kit | |
| Validation | Zod — shared frontend + backend | |
| Auth | JWT + argon2id + httpOnly cookies | |
| Database | PostgreSQL | |
| Media | Cloudinary | Images + video |
| Email | Resend | Phase 7.5 |
| Queue | Redis + BullMQ | Phase 7.5 |
| Hosting | Railway (backend + DB), Vercel (frontend) | |
| CI | GitHub Actions — typecheck, lint, test, build | |

---

## Database Schema

### Tables
| Table | Purpose |
|---|---|
| `trainers` | Accounts, preferences, subscription, usage metrics |
| `clients` | Client roster. `isSelf=true` = trainer's own record |
| `client_goals` | Goal history per client (append-only) |
| `client_snapshots` | Measurement snapshots (body comp, subjective scores) |
| `trainer_usage_monthly` | Billing meter — aggregated usage per trainer per month |
| `exercises` | Exercise library (shared + per-trainer) |
| `exercise_media` | Cloudinary media for exercises |
| `body_parts` | Muscle group taxonomy |
| `templates` | Saved session templates |
| `template_workouts` | Workout blocks within a template |
| `template_exercises` | Exercises within template workouts (with targets) |
| `sessions` | Training events |
| `workouts` | Typed blocks within a session |
| `session_exercises` | Exercises within session workouts (with targets) |
| `sets` | Atomic performance records |
| `refresh_tokens` | Active refresh token store |
| `sync_log` | Offline write queue (Phase 8) |

### Key trainer fields (preferences + metrics)
```
trainerMode:        'athlete' | 'trainer'
subscriptionTier:   'free' | 'pro' | 'studio'
subscriptionStatus: 'trialing' | 'active' | 'pastDue' | 'cancelled'
onboardedAt:        timestamp | null
ctaLabel:           text (default 'Start Training')
alertsEnabled:      boolean (default true)
alertColorScheme:   text (default 'amber')
alertTone:          text (default 'clinical')
widgetProgression:  text | null (comma-delimited widget IDs)
sessionLayout:      text (default 'horizontal')
reportsSentCount:   integer
lastActiveAt:       timestamp | null
```

---

## API Routes

### Auth (`/api/v1/auth/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create account + auto-create self-client |
| POST | `/login` | Issue tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/logout` | Revoke refresh token |
| GET | `/me` | Get current trainer profile |
| POST | `/onboard` | Set trainerMode + onboardedAt |
| PATCH | `/me` | Update profile + preferences |

### Clients (`/api/v1/clients/`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/clients/self` | Get trainer's own self-client |
| GET | `/clients` | List external clients |
| POST | `/clients` | Create client |
| GET | `/clients/:id` | Get client |
| PATCH | `/clients/:id` | Update client |
| DELETE | `/clients/:id` | Soft-delete (blocks self-client) |

### Goals, Snapshots, Sessions, Exercises, Templates
Full CRUD exists for all. See Swagger at `http://localhost:3001/documentation`.

---

## Frontend Routes

| Route | Page | Notes |
|---|---|---|
| `/login` | LoginPage | Public |
| `/onboard` | OnboardingPage | Protected, pre-onboarding only |
| `/` | DashboardPage | Widget stack, branches on trainerMode |
| `/clients` | ClientsPage | Roster + self-client tile |
| `/clients/:id` | ClientProfilePage | 3 tabs: Overview, Timeline, Baseline |
| `/session/new` | SessionLauncherPage | Blank start or template picker |
| `/session/:id` | LiveSessionPage | Active workout, accordion sets, rest timer |
| `/session/:id/summary` | SessionSummaryPage | Post-session stats + scores |
| `/exercises` | ExercisesPage | Exercise library |
| `/templates` | TemplatesPage | Template management |
| `/preferences` | PreferencesPage | All trainer preferences |

---

## UX System

### Interaction model (`lib/interactions.ts`)
All CSS animation class values in one place. Import and apply:
```ts
import { interactions } from '@/lib/interactions'
<button className={cn(interactions.button.base, interactions.fab.pulse)} />
```

### UX Event system (`lib/ux-events.ts`)
33-type taxonomy. Animation + side effects in one call:
```ts
const { fire } = useUXEvent()
fire('create', { target: ref.current, entity: 'client' })
```

**Event categories:** gesture, input, navigation, CRUD, session-specific, system

**Side effects:** Register at app boot via `uxEventRegistry.register()` or `.registerGlobal()`

**Guidance rules:** `GUIDANCE_RULES` array — conditions trigger nudges/tooltips/confirms. Phase 4.5 wires UI.

### Widget system (`lib/widgets.ts`)
- `WIDGET_IDS` — all valid widget IDs
- `WIDGET_META` — label, description, modes, availableFrom phase
- Default orders per mode: `DEFAULT_TRAINER_WIDGET_ORDER`, `DEFAULT_ATHLETE_WIDGET_ORDER`
- `parseWidgetProgression(raw, mode)` — parses DB string, filters unknown IDs, returns defaults if null
- `serializeWidgetProgression(order)` — joins back to string for DB

---

## Preferences System

All trainer preferences stored on the `trainers` record. Read via `usePreferences()` hook:

```ts
const { ctaLabel, alertsEnabled, alertColorScheme, alertTone,
        sessionLayout, widgetOrder, trainerMode,
        updatePreference, updateWidgetOrder } = usePreferences()
```

Every preference saves immediately via `PATCH /auth/me`. No Save button.

**Preferences screen (`/preferences`) sections:**
1. Profile — name, weight unit
2. Training Mode — display only (switching is deferred)
3. Dashboard — CTA label, session layout, widget order (draggable)
4. Alerts — toggle, color scheme, tone

---

## Session System

### Session lifecycle
```
POST /sessions (status: planned)
  → PATCH /sessions/:id (status: in_progress) ← start
  → POST /sessions/:id/workouts
  → POST /workouts/:id/exercises
  → POST /session-exercises/:id/sets  ← log sets
  → PATCH /sessions/:id (status: completed) ← end + subjective scores
```

### Set accordion states
- **Past** — closed, shows actual vs target, color-coded (green = hit/surpassed, orange = missed)
- **Active** — open, large weight+reps inputs, last-time context, Log Set button
- **Future** — greyed placeholder with target values

### Blank session defaults
3 sets, 10 / 8 / 6 reps. Weight inherits from previous set.

### Rest timer
Fires `rest_tick` + haptic each second. `rest_complete` + sharp pulse at zero.
Persistent top banner — stays visible while scrolling between exercises.

---

## Domain-Driven Design

### Ubiquitous Language

The language used in code, conversations, and documentation is the same. When in doubt, use these terms — never synonyms.

| Term | Definition | Never say |
|---|---|---|
| **Trainer** | The app's primary user. Could be a professional coach or an athlete tracking themselves. | User, coach, admin |
| **Athlete** | A Trainer in athlete mode — no client roster, only self-tracking. Not a separate entity. | Self-user, personal user |
| **Client** | A person whose training a Trainer manages. Always owned by exactly one Trainer. | Athlete (when in trainer context), student, member |
| **Self-client** | The Client record that represents the Trainer themselves (`isSelf=true`). Auto-created at registration. | Personal profile, own record |
| **Session** | A single training event. Has a date, a status lifecycle, and belongs to one Client. | Workout (the whole thing), training, class |
| **Workout** | A typed block within a Session (e.g. "Resistance", "Cardio"). Groups related exercises. | Block (informally ok in discussion), circuit |
| **Exercise** | A named movement in the library (Squat, Run, Plank). Belongs to a Trainer or is shared. | Move, lift, drill |
| **Set** | One recorded effort within a SessionExercise. The atomic unit of performance data. | Rep (a set contains reps), log entry |
| **Template** | A reusable Session plan. Contains Workouts and target values. Applied to create a Session. | Program, plan, routine |
| **Snapshot** | A point-in-time measurement capture for a Client. Can be full (body comp + functional) or minimal (subjective scores only). | Assessment (assessment is a progressionState, not a snapshot), check-in |
| **Goal** | A text statement of intent for a Client at a point in time. History table — never deleted. | Target, objective |
| **Progression State** | Where a client is in their training arc: `assessment`, `programming`, or `maintenance`. | Phase (overloaded), level, stage |
| **Focus** | The primary training modality: `resistance`, `cardio`, `calisthenics`, `mixed`. | Type, style, discipline |
| **Trainer Mode** | The product experience: `athlete` (self-only) or `trainer` (roster + self). | Role, account type |
| **Subscription Tier** | The billing level: `free`, `pro`, `studio`. Orthogonal to Trainer Mode. | Plan, tier, level |
| **Widget** | A configurable dashboard tile with a specific data source and display style. | Card (informally ok), panel, module |
| **Widget Progression** | The ordered list of widgets on a Trainer's dashboard. Stored as comma-delimited text. | Widget order, dashboard layout |
| **CTA Label** | The text on the "start training" button. Personalised per Trainer. | Button text, action label |
| **Rest Timer** | The countdown between sets. Started automatically on set log. | Break timer, recovery timer |
| **At-Risk** | A Client with no Session logged in the last 14 days. A signal, not a status field. | Inactive, lapsed |

---

### Bounded Contexts

A bounded context is a boundary within which a model has a consistent meaning. Across boundaries, the same word may mean something different.

```
┌─────────────────────────────────────────────────────────────────┐
│  IDENTITY CONTEXT                                               │
│  Trainer accounts, authentication, subscription, preferences    │
│  Core entity: Trainer                                           │
│  Key concepts: trainerMode, subscriptionTier, onboardedAt       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Trainer owns →
┌───────────────────────────▼─────────────────────────────────────┐
│  ROSTER CONTEXT                                                 │
│  Client management, goals, snapshots, progression               │
│  Core entity: Client (including self-client)                    │
│  Key concepts: progressionState, focus, isSelf, Goal, Snapshot  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Client participates in →
┌───────────────────────────▼─────────────────────────────────────┐
│  TRAINING CONTEXT                                               │
│  Session logging, set recording, performance tracking           │
│  Core entity: Session                                           │
│  Key concepts: Workout, Exercise, Set, Template, rest timer     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Training data feeds →
┌───────────────────────────▼─────────────────────────────────────┐
│  INSIGHT CONTEXT                                                │
│  KPIs, trends, stall detection, monthly reports                 │
│  Core entity: TrainerUsageMonthly, computed metrics             │
│  Key concepts: volume, 1RM estimate, streak, at-risk flag       │
│  Status: Phase 7 — not yet built                                │
└─────────────────────────────────────────────────────────────────┘
```

**Cross-context translation points:**
- A `Client` in the Roster context becomes a `session.client` summary in the Training context (id, name, photoUrl only — no goals or snapshots bleed across)
- A `Session` in the Training context becomes a data point in the Insight context (date, volume, subjective scores — not the full set-by-set detail)
- A `Trainer` in the Identity context becomes a `trainerId` foreign key in all other contexts — no preference fields bleed into Training or Insight

---

### Aggregates

An aggregate is a cluster of objects treated as a unit for data changes. The aggregate root is the entry point — you never modify internals directly.

**Trainer aggregate (Identity context)**
- Root: `Trainer`
- Contains: preferences (ctaLabel, widgetProgression, etc.), subscription fields
- Invariants: onboardedAt is set exactly once; subscriptionTier + trainerMode are a valid combination (no athlete + studio)
- Modified via: `POST /auth/onboard`, `PATCH /auth/me`

**Client aggregate (Roster context)**
- Root: `Client`
- Contains: `Goal[]`, `Snapshot[]`
- Invariants: exactly one `isSelf=true` Client per Trainer; self-client cannot be deleted; progressionState must be a valid enum value
- Modified via: `/clients/:id` routes, `/clients/:id/goals` routes, `/clients/:id/snapshots` routes
- Note: Goals are append-only (history). Snapshots are append-only (time-series). Neither is ever truly deleted — deletion removes history.

**Session aggregate (Training context)**
- Root: `Session`
- Contains: `Workout[] → SessionExercise[] → Set[]`
- Invariants: status follows a strict lifecycle (`planned → in_progress → completed | cancelled`); a Set belongs to exactly one SessionExercise; setNumber is 1-based and sequential per exercise
- Modified via: session routes, workout routes, set routes
- Note: The full session tree is always loaded at once for the live session view. This is intentional — the UI needs all workout blocks and all sets to render the accordion correctly.

**Exercise aggregate (Training context)**
- Root: `Exercise`
- Contains: `ExerciseMedia[]`
- Invariants: isDraft=true until name + bodyPartId + workoutType are all set; media has exactly one isPrimary=true or none
- Modified via: `/exercises/:id` routes, `/exercises/:id/media` routes

**Template aggregate (Training context)**
- Root: `Template`
- Contains: `TemplateWorkout[] → TemplateExercise[]`
- Invariants: TemplateExercise belongs to exactly one TemplateWorkout; orderIndex is unique within a workout
- Modified via: `/templates/:id` routes

---

### Domain Events

Events that have meaning in the domain. The UX event system (`ux-events.ts`) captures the UI expression of these. The domain events themselves are not yet formally stored — they will feed the Insight context in Phase 7.

| Domain Event | Trigger | Downstream significance |
|---|---|---|
| `ClientEnrolled` | New Client created | Starts the progression arc; self-client auto-enrolled at registration |
| `GoalSet` | Goal created for Client | Anchors the current phase intent; appears in monthly report |
| `GoalAchieved` | Goal.achievedAt set | Celebratory moment; triggers next-goal nudge |
| `SnapshotCaptured` | Snapshot created | Baseline established or progress measured |
| `ProgressionStateChanged` | Client.progressionState updated | Phase transition; triggers full snapshot recommendation |
| `SessionStarted` | Session status → in_progress | Training is live; rest timer and set logging begin |
| `SetLogged` | Set created | Atomic performance captured; volume accumulates |
| `SessionCompleted` | Session status → completed | Full training event recorded; KPI recalculation triggered |
| `ReportDispatched` | Monthly report sent | reportsSentCount incremented; client receives proof of progress |

---

### Key Domain Rules

Rules that the system enforces (or will enforce). Listed here so they aren't scattered across route files.

1. **One self-client per trainer.** Created at registration, never deleted, never duplicated.
2. **Goals are history.** A Goal is never truly deleted — deletion removes part of the client narrative. Prefer marking achieved.
3. **Set numbers are sequential per exercise.** Set 1, 2, 3 — no gaps. Deleting a set should renumber (not yet enforced, deferred to Phase 6).
4. **Session status is a one-way lifecycle.** `planned → in_progress → completed`. You cannot move backwards. Cancelled is a terminal state like completed.
5. **Weight unit is stored per set.** Never coerce historical records if the trainer changes their preference. Display conversion is always in the UI layer.
6. **Trainer mode and subscription tier are orthogonal.** No code should assume `athlete = free` or `trainer = paid`. Check both fields independently.
7. **Billing gates are additive.** A free trainer can do everything a pro trainer can do, just up to a limit. Never remove capability — just cap it.
8. **The self-client is a first-class client.** All session, goal, snapshot, and report routes treat isSelf=true identically to isSelf=false. Athlete mode is just a UI skin over this fact.

---



Phases are the **navigation system** for development — the "what and why" of each major step.
Semver versions are the **record system** — the "when and what changed" of each delivery.

One phase may span multiple versions (e.g. Phase 4 spans v1.4.0–v1.4.5). A version may be
a sub-phase patch (schema only), a full phase delivery, or a hotfix.

```
Phase → defines the goal and scope
Version → records the delivery and tracks progress through the phase
```

---

### Phase 1 — Scaffold
**Goal:** Establish the monorepo, database schema, and API surface before any UI.
**What:** pnpm workspace, Fastify backend, Drizzle + PostgreSQL, full DB schema, Swagger docs.
**Versions:** v1.0.0
**Status:** ✅ Complete

---

### Phase 2 — Authentication
**Goal:** Secure the API and establish the identity model.
**What:** JWT access tokens, argon2id password hashing, httpOnly refresh token cookies,
token rotation, rate limiting, device tracking, authenticate middleware.
**Versions:** v1.1.0 (auth), v1.1.1 (120 unit tests)
**Status:** ✅ Complete

---

### Phase 3 — Exercise Library
**Goal:** Give trainers a usable library of movements before sessions exist.
**What:** Exercise CRUD, body part taxonomy, Cloudinary media uploads (image + video),
draft/publish flow, Storybook component library.
**Versions:** v1.2.0 (library UI), v1.2.1 (Storybook)
**Status:** ✅ Complete

---

### Phase 3C — Client Schema
**Goal:** Model the full client data structure before building any client UI.
**What:** Client goals (history table), client snapshots (time-series measurements),
self-client concept (isSelf), session subjective scores, ProgressionStateEnum,
ClientFocusEnum, full CRUD routes for goals and snapshots.
**Versions:** v1.3.0
**Status:** ✅ Complete

---

### Phase 3D — SaaS + Metrics Schema
**Goal:** Add the schema foundations for multi-mode product and future billing.
**What:** trainerMode (athlete | trainer), subscription tier/status, onboardedAt,
trainer_usage_monthly table (billing meter), lastActiveAt on trainers + clients,
POST /auth/onboard and PATCH /auth/me routes.
**Versions:** v1.3.1
**Status:** ✅ Complete

---

### Phase 4 — Client Management UI + Onboarding
**Goal:** Trainers can manage clients and athletes can find their training.
**What:** Onboarding screen (mode selection), OnboardingGate routing,
client list with self-client tile, client profile (3 tabs: Overview/Timeline/Baseline),
goal list (ordered, achievable), snapshot history with baseline delta,
SilhouetteAvatar, AddClientCard with pulsing + badge, ClientDrawer (context-aware add/edit),
dashboard with widget system, preferences schema, preferences screen,
UX event system (33-type taxonomy, animation engine, side-effect registry).
**Versions:** v1.4.0–v1.4.5
**Status:** ✅ Complete

**Sub-phases:**
- v1.4.0 — Client UI + onboarding screen
- v1.4.1 — Preference schema (ctaLabel, alertsEnabled, widgetProgression)
- v1.4.2 — Dashboard with widget stack
- v1.4.3 — Storybook pass for Phase 4 components
- v1.4.4 — UX event system (`ux-events.ts`, `useUXEvent`)
- v1.4.5 — Preferences screen (CTA picker, widget order, alert customization, session layout)

---

### Phase 5 — Session Logging
**Goal:** Trainers can conduct and log a live training session end-to-end.
**What:** Session launcher (/session/new), live session screen (/session/:id),
set accordion (past/active/future with target vs actual color coding),
rest timer banner, end session flow with subjective score sliders,
session summary screen, session layout preference (horizontal/vertical),
full session query hooks, template loading.
**Versions:** v1.5.0 (core logging), v1.5.1 (history + timeline — next)
**Status:** 🔄 In progress

**Sub-phases:**
- v1.5.0 — ✅ Core session logging (launcher → live → summary)
- v1.5.1 — ✅ Session history on client timeline, exercise history drawer

---

### Phase 6 — Session History + Per-Exercise History
**Goal:** Surface the data being captured. History makes logging meaningful.
**What:** Session list on client profile Timeline tab, session detail view,
per-exercise history drawer ("last 3 times" context), session cards with
workout types / set count / volume / subjective scores.
**Note:** Phase 5 captures the data. Phase 6 makes it visible and navigable.
**Versions:** v1.5.1 (partial), v1.6.x
**Status:** 🔜 Not started

---

### Phase 7 — KPI Dashboard
**Goal:** Answer "Is this client moving forward?" in under 10 seconds.
**What:** Focus-aware KPIs per client (resistance: volume/1RM/PRs,
cardio: miles/pace, calisthenics: max reps, mixed: consistency),
stall detection, at-risk flags, streak calculation,
trainer_usage_monthly population, volume/streak dashboard widgets.
**Versions:** v1.7.x
**Status:** 🔜 Not started

---

### Phase 7.5 — Monthly Reports (Email)
**Goal:** Deliver the client-facing proof of value.
**What:** Resend email integration, HTML report template, narrative structure
(goal arc + key metrics + trend commentary), "Send Report" button on client profile,
Redis + BullMQ for async report dispatch, reportsSentCount increment.
**Versions:** v1.7.5
**Status:** 🔜 Not started

---

### Phase 4.5 — Settings + Preferences (Deferred sub-phase)
**Goal:** Full personalization UI — everything in Preferences that was deferred.
**What:** CTA label custom text input, drag-to-reorder widgets on dashboard,
GuidanceNudge UI component wired to guidance rules, mood/accent color override,
alertColorScheme + alertTone exposed in preferences UI, trainer mode switching.
**Note:** The schema and hooks are already built. This phase adds the UI surfaces.
**Versions:** v1.5.x (fits alongside session history work)
**Status:** 🔜 Partially deferred from v1.4.5

---

### Phase 8 — Offline Sync
**Goal:** The app works without internet. Sets logged offline sync when back online.
**What:** IndexedDB for local write queue, Workbox service worker, background sync,
sync_log table replay, conflict resolution strategy, sync status indicator in nav.
**Note:** sync_log table already exists. sessionStore has pendingSets placeholder.
**Versions:** v1.8.0
**Status:** 🔜 Not started

---

### Phase 9 — SaaS Launch
**Goal:** The app charges money and manages its own subscriptions.
**What:** Stripe integration, billing gate enforcement (free/pro/studio limits),
subscription management UI, trainer_usage_monthly Stripe meter sync,
client portal magic link (read-only report access), multi-trainer studio accounts.
**Versions:** v2.4.0
**Status:** 🔜 Not started

---



| Version | Key Deliverable | Status |
|---|---|---|
| v1.0.0 | Scaffold, schema, Swagger | ✅ |
| v1.1.0 | Auth — JWT, argon2, refresh tokens | ✅ |
| v1.1.1 | 120 unit tests | ✅ |
| v1.2.0 | Exercise library UI + Cloudinary | ✅ |
| v1.2.1 | Storybook component library | ✅ |
| v1.3.0 | Client goals, snapshots, self-training schema | ✅ |
| v1.3.1 | Usage metrics, trainerMode, onboarding schema | ✅ |
| v1.4.0 | Client management UI, onboarding screen | ✅ |
| v1.4.1 | Preference schema | ✅ |
| v1.4.2 | Dashboard with widget system | ✅ |
| v1.4.3 | Storybook — Phase 4 components | ✅ |
| v1.4.4 | UX event system | ✅ |
| v1.4.5 | Preferences screen | ✅ |
| v1.5.0 | Session logging | ✅ |
| v1.5.1 | Session history + client timeline | ✅ |
| v1.6.0 | KPI dashboard | ✅ |
| v1.7.0 | Monthly reports (Resend email) | ✅ |
| v1.7.5 | Redis + BullMQ — scheduled reports + at-risk alerts | ✅ |
| v1.8.0 | Live session: add blocks, exercises, set logging, session store | ✅ |
| v1.9.0 | Exercise library UI | ✅ |
| v2.0.0 | SPA refactor — panels, overlays, persistent session | ✅ |
| v2.1.0 | Session planning — "plan the day" workflow | ✅ |
| v2.2.0 | Sessions view — history list | ✅ |
| v2.3.0 | Nav event bus — debouncing, audit log, RxJS-ready (full RxJS deferred to v3.1.0) | ✅ |
| v2.4.0 | Offline sync — write queue, prefetch, banner | ✅ |
| v2.5.0 | UI/UX polish — execution layout, PR system, gamification foundations | ✅ |
| v2.6.0 | ESLint + code quality | ✅ |
| **v2.7.0** | **Post-session wrap-up + auto-populate from history + drag reorder** | 🔜 Next |
| v2.8.0 | Camera / video capture + coach challenges | 🔜 |
| v2.9.0 | Leaderboards + weekly quests + social share | 🔜 |
| v3.0.0 | SaaS — Stripe, subscription billing gates | 🔜 |
| v3.1.0 | Observable navigation — RxJS swap inside navService | 🔜 |

---

## v2.5.0 Spec — UI/UX Polish + Gamification Foundations

### Session execution layout — WorkoutBlock redesign

**The change:** exercises within a block navigate horizontally (same snap-scroll pattern as blocks), not vertically stacked. The set spine stays vertical within the current exercise only.

**Navigation model:**
```
← Block 1 | Block 2 | Block 3 →        top dot row — block position
           ← Ex 1 | Ex 2 | Ex 3 →      mid dot row — exercise position within block
                    Set 1               vertical spine — sets within current exercise
                    Set 2
                    Set 3  ← active hero
```

**Peek cards (tappable):**
- Left peek — previous exercise, shows name + final logged value (e.g. "Bench · 100×8"). Tap to jump back.
- Right peek — next exercise, shows name + targets (e.g. "OHP · 3×8"). Tap to jump ahead.
- Swipe gesture also navigates (existing snap-scroll behaviour)
- Opacity 0.5 (past) and 0.4 (future) to visually recede

**Footer bar:**
- Single full-width bar, rounded with the card, not floating buttons
- Two carved sections divided by a hairline: "Add exercise" (left, primary weight) | "New block" (right, secondary weight)
- After set log: footer temporarily replaced by rest timer bar ("Rest 1:30 · Skip")
- After rest timer ends: footer restores to Add exercise / New block

**PR flash sequence (on set log):**
1. Log set tapped
2. If new PR detected: PR flash fills log area (~1.5s) — "New PR · 105kg × 5" amber treatment
3. Simultaneously: rest timer slides into footer bar
4. Flash fades, PR chip appears on the logged set row in the spine (amber pill "PR")
5. Rest timer counts down in footer
6. Timer ends: footer restores to Add exercise / New block

**Overview mode (plan builder) — unchanged:**
- Vertical exercise list, targets shown inline, no set spine

---

### PR system — data + UI

**Schema addition:** `isPR` and `isPRVolume` boolean columns on `sets` table.

**Detection at log time (backend):**
- Query historical max 1RM estimate for this client + exercise
- Epley formula: `weight × (1 + reps / 30)`
- If new set's Epley score exceeds all prior sets → `isPR = true`
- Also check max volume (weight × reps) → `isPRVolume = true`
- Both tracked independently, both can be true on same set

**Where PRs surface:**
- Live session: PR flash + persistent chip on set row
- Session history detail: PR chip inline on set row
- Session history: "PRs only" filter — every PR grouped by exercise
- Client profile: "Personal Bests" section — best 1RM + best volume per exercise with ⓘ tooltips

**ⓘ tooltips:**
- 1RM: *"Estimated max single rep using the Epley formula: weight × (1 + reps / 30)"*
- Volume: *"Highest single-set volume: weight × reps"*

---

### Gamification foundations — client profile

**Streaks:** current streak (consecutive weeks ≥1 session) + longest ever. On KPI hero + monthly email.

**Consistency score:** rolling 4-week score (sessions completed ÷ targeted × 100). Requires `targetSessionsPerWeek` on client (default 3). Replaces/augments at-risk indicator.

**Personal Bests section:** tabbed list per exercise — best 1RM estimate + best volume + dates. Filterable by workout type. ⓘ on column headers.

---

### Code quality — DRY pass

**`lib/exerciseLabels.ts`** — consolidates WORKOUT_TYPE_VARIANTS, WORKOUT_TYPE_LABELS, WORKOUT_TYPE_COLORS, EQUIPMENT_LABELS, DIFFICULTY_COLORS (currently duplicated across 4+ files).

**`lib/formatters.ts`** — consolidates formatDate, formatDuration, formatElapsed, formatEpley, formatVolume (currently duplicated across 4+ files).

---

## Current State (v2.4.0)

All core training workflows complete and offline-capable. The app covers the full trainer day: plan sessions for multiple clients, execute live with set logging, review history, all working offline with sync on reconnect.

### Active: v2.5.0 — UI/UX Polish + Gamification Foundations

**ExercisesPage** — browsable library:
- Filter by workout type (resistance / cardio / calisthenics / stretching / cooldown)
- Filter by body part (arms / back / chest / core / legs / shoulders / full_body)
- Resistance exercises also filterable by compound / isolation
- Search by name
- Draft exercises shown with badge — tap to enrich
- "Add to Workout" CTA — context-aware (see below)

**Exercise detail view:**
- Hero section — visualization (still image) or demonstration (video), toggle between them
- Placeholder shown when both are null (Phase 9 content population)
- Exercise info below: name, body part, equipment, difficulty, category, description, instructions
- "Add to Workout" footer CTA

**"Add to Workout" CTA — context-aware rules:**
- Disabled if no sessions open (planned or active)
- Adds directly if exactly one session open
- Shows a session picker sheet if multiple sessions are open
- Session picker lists all open sessions by client name + session type (planned/active)

**Draft enrichment flow:**
- isDraft exercises show an amber "Draft" badge in the library
- Tapping a draft opens an inline edit form: name, body part, description
- Saving clears the isDraft flag

---

## Known Deferred Items (summary)

Full details in `DEFERRED_ITEMS.md`.

| Item | Deferred to |
|---|---|
| Subscription billing gates | v3.0.0 SaaS |
| Email verification | Multi-trainer launch |
| Password reset flow | Settings UI phase |
| Visualization / demonstration content | Phase 9 (post-SPA) |
| Draft exercise enrichment queue | v1.9.x |
| Post-session wrap-up | After session planning (v2.2.0+) |
| Observable navigation service | v2.3.0 |
| Offline sync | v2.4.0 |
| ESLint setup | Dedicated code quality version |
| SMS report delivery | When paying clients need it |
| Redis + rate limiting persistence | v1.7.5 |
| Offline sync | v1.8.0 |
| Playwright E2E tests | Phase 5+ (noted in CI yml) |
| Database migration dry-run in CI | Phase 6 (noted in CI yml) |

---

## Development Workflow

```bash
# Daily dev
pnpm dev                          # runs frontend + backend

# Schema changed?
cd apps/backend && pnpm db:push   # dev only — applies directly, no migration files

# Seed exercise library (first time or after reset)
cd apps/backend && pnpm db:seed

# Typecheck
pnpm typecheck                    # run from monorepo root. Silence = success.

# Tests
pnpm --filter backend test

# Ship a hotfix (no tag — dev iteration)
./hotfix.sh "fix: description"

# Ship a release (commits + tags + pushes)
./release.sh v1.9.0 "feat: exercise library UI"
```

---

## Review Checklist (end of each version)

Before marking a version complete, verify:

- [ ] `pnpm typecheck` passes (silence = success)
- [ ] `pnpm --filter backend test` passes
- [ ] `pnpm dev` starts without errors
- [ ] New DB columns: `pnpm db:push` or `pnpm db:generate && pnpm db:migrate`
- [ ] `CHANGELOG.md` updated
- [ ] `PROJECT_STATE.md` updated (this file)
- [ ] `DEFERRED_ITEMS.md` updated with anything newly deferred
- [ ] Storybook stories added for new components
- [ ] `./release.sh vX.X.X "message"` run — CI passes on GitHub

---

## Architecture Decision Record — SPA Refactor (March 2026)

### Context
The app uses React Router v6 in a route-per-page pattern. Every major transition unmounts the current tree and mounts a new one. This causes the live session UI to feel disconnected — starting a session navigates away from the client context entirely.

### Decision: True SPA — layered panels, Zustand owns state, URL is secondary

Navigation transitions to animated panel/overlay model. URL updates as a side-effect of state changes, not as the cause of them. React Router stays but is demoted from controller to observer.

### Session Model — Two Types

| | Planned Session | Active Session |
|---|---|---|
| State | Being built, edited | Executing right now |
| Time | Async — days to build | Real-time |
| Concurrent | Many open at once (chest day, leg day…) | One per person |
| UI | Editor — calm, structured | Full focus, minimal chrome |

**The athlete is the atom.** Trainer's `isSelf` client is an athlete account. Everything built for the athlete is inherited by the trainer for their own training. Trainer layer adds client management on top.

### Concurrent Session Model
- `plannedSessions: Record<sessionId, PlannedSession>` — many, any owner, workspace tabs
- `activeSessions: Record<clientId, ActiveSession>` — one per person, real-time overlay

Active session uses the Spotify model: full-screen overlay, swipe down to minimise to a persistent pill, tap pill to restore. Multiple active sessions (trainer's own + client's) = multiple pills, stacked.

### Z-Index Layer Stack

| Layer | What | Z-index |
|---|---|---|
| 0 — Base | Dashboard, list pages | 0 |
| 1 — Panel | Client profile, session history, planned session editor | 10 |
| 2 — Planned session pill | Minimised planned sessions indicator | 15 |
| 3 — Active session overlay | Live executing session (full-screen) | 20 |
| 4 — Active session pill | Minimised active session (Spotify bar) | 25 |
| 5 — Sheet | Bottom sheets | 30 |
| 6 — Modal | Destructive confirms | 40 |
| 7 — Nav | Tab bar — hidden when active session is full-screen | 50 |
| 8 — Toast | Notifications | 60 |

Nav hides when active session overlay is full-screen. Swipe down → overlay minimises → pill appears above nav → nav reappears.

### Back Button Strategy
**Phase 1 (SPA refactor):** React Router location state — each panel push adds a history entry. Back button pops the entry and closes the panel. Handles Android back button and PWA standalone mode correctly by default.

**Phase 2 (post-SPA):** Migrate nav to observable-based navigation service (RxJS). The nav service is abstracted from day one so this is an internal implementation swap, not a surface change. Observables solve rapid open/close race conditions and give a single auditable stream of all navigation events.

"PWA install behaviour is correct" with React Router means: when installed to home screen in standalone mode, Android's back button fires a `popstate` event. React Router's history stack handles this natively. Raw `history.pushState` without a `popstate` listener would exit the app instead.

### SPA Refactor Sequence
1. **Exercise library** (current) — complete before refactor
2. **Active session → persistent overlay** (highest value, fixes core UX complaint)
3. **Session launcher → bottom sheet** (natural companion)
4. **Client profile → slide panel** (unlocks plan-the-day workflow)
5. **Session history/summary → inner views**
6. **URL side-effect sync** (polish — last)
7. **Observable navigation service** (post-refactor migration)

---

## Exercise Library (v1.8.5 — current focus)

### Schema additions
- `exercises.visualization` — text (URL), nullable — muscle-group diagram image
- `exercises.demonstration` — text (URL), nullable — form demonstration video URL
- `ExerciseDetailResponseSchema` — updated to include both fields + nullable trainerId/bodyPartId

### Exercise library source
`apps/backend/src/db/seeds/exercises-library.json` — 109 exercises, editable JSON.

To re-seed after editing the JSON: delete public exercises from DB, then run `pnpm db:seed`.
To add individual exercises after initial seed: use `POST /exercises` or direct DB insert/update.

### Exercise counts
| Category | Count |
|---|---|
| Resistance — compound | 24 |
| Resistance — isolation | 24 |
| Cardio | 14 |
| Calisthenics | 18 |
| Stretching | 22 |
| Cooldown | 7 |
| **Total** | **109** |

### Exercise detail page design (planned)
- **Hero section** — visualization (still image) or demonstration (video) with toggle between them
- **Exercise info** — name, body part, equipment, difficulty, description, instructions
- **Footer CTA** — "Add to Workout" (context-aware: disabled if no active/planned session)
- **Draft badge** — shown on exercises created mid-session, prompts enrichment

### Visualization and demonstration content (Phase 9 — deferred)
- Visualizations: muscle-group highlight diagrams (like gym machine graphics)
- Demonstrations: video links to proper form demonstrations
- Content population deferred to Phase 9 (post-SPA refactor)
- May be AI-generated, licensed, or user-uploaded depending on cost/quality tradeoff
- Schema is ready — fields exist, currently null in seed

### db:seed command
```bash
cd apps/backend
pnpm db:push    # apply schema changes (visualization, demonstration columns)
pnpm db:seed    # seeds body parts then all 109 exercises
```

---

## Session Metrics by Workout Type (locked)

| Type | Primary metrics | Secondary |
|---|---|---|
| Resistance | sets, reps, weight | RPE |
| Cardio | distance, time, reps | RPE, pace |
| Calisthenics | sets, reps, time | RPE |
| Stretching | time (hold duration) | side (L/R/both) |
| Cooldown | time | — |

