# TrainerApp — Project State Document

> **Last updated:** v1.5.1
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
**Versions:** v2.0.0
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
| v1.6.0 | KPI dashboard | 🔜 Next |
| v1.7.0 | Monthly reports (Resend email) | 🔜 |
| v1.7.5 | Redis + BullMQ for report queue | 🔜 |
| v1.8.0 | Offline sync — IndexedDB + Workbox | 🔜 |
| v2.0.0 | SaaS launch — Stripe, billing gates | 🔜 |

---

## What's Next (v1.6.0)

**KPI Dashboard** — the answer to "Is this client moving forward?"

Per-client key performance indicators surfaced on the client profile and as a trainer-level overview. The data is already being captured — this phase calculates and displays it.

Core KPIs per focus type:
- Resistance: total volume trend, estimated 1RM per exercise, PR tracking
- Cardio: distance/duration trend, pace improvement
- Calisthenics: max reps trend
- All: consistency score (sessions per week vs target), streak, at-risk flag (14+ days no session)

Trainer-level overview: active client count, total sessions this month, at-risk clients list, top performers.

This feeds directly into the monthly report (v1.7.0) — the report is a narrative wrapper around these numbers.

---

## Known Deferred Items (summary)

Full details in `DEFERRED_ITEMS.md`. Key items:

| Item | Deferred to |
|---|---|
| Subscription billing gates | SaaS phase (v2.0.0) |
| Email verification | When multi-trainer opens |
| Password reset flow | Settings UI phase |
| Trainer mode switching UI | Settings UI phase |
| Preferences Phase 4.5 (full mood system, alert customization UI) | v1.5.x |
| Widget drag-to-reorder on dashboard | v1.5.x |
| GuidanceNudge UI component | v1.5.0+ (rules exist, UI not wired) |
| `trainer_usage_monthly` population job | SaaS phase |
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

# Typecheck
pnpm typecheck                    # run from monorepo root. Silence = success.

# Tests
pnpm --filter backend test

# Ship a version
./release.sh v1.5.1 "feat: session history"

# Ship a hotfix
./hotfix.sh "fix: catch block in sessions.ts"
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
