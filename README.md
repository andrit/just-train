# Just Train

A mobile-first PWA for fitness trainers and athletes to plan sessions, track performance, and build lives around consistent training. _(Internal/repo name: `trainer-app`; the product name is **Just Train**, domain `just-train.fit`.)_

**Current status:** release **v2.14.0** shipped; a large unreleased body of work is in flight (see Build Phases). Managed through the workbench PWA SDLC — currently **Phase 19, Go Live** (gated on launch assets: logo/icons, domain SSL cut-over, brand sign-off).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| State | TanStack Query (server), Zustand (client, persisted) |
| PWA | vite-plugin-pwa, Workbox, offline write queue (localStorage → IndexedDB-ready) |
| Backend | Fastify 5, TypeScript |
| ORM | Drizzle + drizzle-kit |
| Validation | Zod (shared between frontend + backend) |
| Auth | JWT access tokens + argon2 + httpOnly cookies |
| Database | PostgreSQL |
| Media | Cloudinary |
| Email | Resend |
| Queue | BullMQ + Upstash Redis |
| Hosting | Railway (backend + DB), Vercel (frontend) |

Split by design — Vercel CDN for PWA load speed, Railway for API + Postgres co-location.

---

## Monorepo Structure

```
trainer-app/
├── packages/shared/          # Enums, Zod schemas, TypeScript types
├── apps/backend/
│   └── src/
│       ├── db/
│       │   ├── schema/       # Drizzle table definitions (one file per domain)
│       │   └── seeds/        # Public exercise library + body parts + muscle-map data
│       ├── middleware/       # authenticate, requireRole
│       ├── queues/           # BullMQ workers + scheduler (reports, at-risk, purge, cleanup)
│       ├── routes/           # auth, account, clients, exercises, sessions, templates,
│       │                     #   challenges, reports, kpis, media, snapshots, telemetry
│       └── services/         # report, alert, account, email, cloudinary, devices, lockout
└── apps/frontend/
    └── src/
        ├── components/       # UI components by domain
        ├── hooks/            # usePreferences, useRestTimer, useUXEvent, useSignOut
        ├── lib/              # api.ts, queries/, interactions.ts, mode.ts (mode theme), widgets.ts
        ├── pages/            # Route pages
        └── store/            # authStore, sessionStore, overlayStore
```

---

## Terminology

| Term | Meaning |
|---|---|
| **Session** | A full training event for a client/athlete on a date |
| **Workout** | A typed block within a session (resistance, cardio, etc.) |
| **Exercise** | A movement in the library |
| **Set** | One recorded effort — the atomic tracking unit |
| **Planned session** | Built in advance, not yet executing |
| **Active session** | Currently being executed in real time |
| **Circuit** | A group of exercises performed round-major (interwoven) — members share a `circuit_id`, rounds = shared target sets |
| **Snapshot** | A point-in-time measurement capture for a client/athlete |
| **Challenge** | A measurable goal with a deadline |

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL (local or Railway)

### Install

```bash
pnpm install
pnpm approve-builds    # approve native builds (argon2, esbuild)
pnpm install           # re-run after approving
```

### Environment

```bash
cp apps/backend/.env.example apps/backend/.env
# Fill in DATABASE_URL, JWT_SECRET, COOKIE_SECRET
```

### Database

```bash
# Always run from apps/backend/
cd apps/backend

pnpm db:push      # apply schema changes (dev only — never against production)
pnpm db:seed      # seed body parts, the public exercise library, and muscle-map data
pnpm db:studio    # open Drizzle Studio visual browser

# Production schema changes use generated migrations, not db:push:
npx drizzle-kit generate            # after any schema change — commit the migration file
# DATABASE_URL="<prod>" npx drizzle-kit migrate   # apply pending migrations to prod
```

### Run

```bash
# From monorepo root
pnpm dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
# API Docs: http://localhost:3001/documentation  (dev only)
```

### Pre-commit gate

```bash
# From monorepo root — the single gate CI mirrors
pnpm verify    # shared build → typecheck → all tests → lint (stops at first failure)
```

---

## Git Workflow

```bash
# Hotfix (no tag — dev iteration)
./hotfix.sh "fix: description"

# Release (commits, tags, pushes — CI must pass)
./release.sh v1.9.0 "feat: description"

# First-time setup
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git add .
git commit -m "feat: initial commit"
git push -u origin main
```

### Updating to a new version

```bash
unzip -o TrainerApp-vX.X.X.zip -d .
cd apps/backend && pnpm db:push && cd ../..
./release.sh vX.X.X "feat: description"
```

---

## CI / CD

GitHub Actions runs on every push to `main`:
1. `pnpm typecheck` — TypeScript across all packages
2. `pnpm lint` — ESLint, `--max-warnings 0` (must be clean; shipped v2.6.0)
3. `pnpm --filter backend test` — Vitest unit tests (mocked DB, no database needed)
4. **Real-DB ownership matrix** — a `postgres:16` service + `drizzle-kit push`, then
   `pnpm --filter backend test:db`: trainer B must get `404` (never `403`/`400`) on every
   parameterised route addressing trainer A's rows, plus the account-purge order (gate G3)
5. `pnpm build` — full build verification

---

## Build Phases

Two tracks run in parallel. **Versions** are the record system (what shipped, when); the
**PWA SDLC phase** is the navigation system (where the project is in its lifecycle — currently
**Phase 19, Go Live**). The authoritative, always-current copy of both lives in
[`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md); this table mirrors it.

| Version | Description | Status |
|---|---|---|
| v1.0.0 | Scaffold, DB schema, Swagger | ✅ |
| v1.1.0 | Auth — JWT, argon2, refresh tokens | ✅ |
| v1.1.1 | Unit tests (120) | ✅ |
| v1.2.0 | Exercise library UI + Cloudinary | ✅ |
| v1.2.1 | Storybook component library | ✅ |
| v1.3.0 | Client goals, snapshots, self-training schema | ✅ |
| v1.3.1 | Usage metrics, trainerMode, onboarding schema | ✅ |
| v1.4.0 | Client management UI, onboarding screen | ✅ |
| v1.4.1–1.4.5 | Preferences, dashboard widgets, UX event system | ✅ |
| v1.5.0–1.5.1 | Session logging + history + client timeline | ✅ |
| v1.6.0 | KPI dashboard | ✅ |
| v1.7.0 | Monthly reports (Resend email) | ✅ |
| v1.7.5 | Redis + BullMQ — scheduled reports + at-risk alerts | ✅ |
| v1.8.0 | Live session: blocks, exercises, set logging, session store | ✅ |
| v1.9.0 | Exercise library UI | ✅ |
| v2.0.0 | SPA refactor — panels, overlays, persistent session | ✅ |
| v2.1.0 | Session planning — "plan the day" | ✅ |
| v2.2.0 | Sessions view — history list | ✅ |
| v2.3.0 | Nav event bus — debouncing, audit log, RxJS-ready | ✅ |
| v2.4.0 | Offline sync — write queue, prefetch, banner | ✅ |
| v2.5.0 | UI/UX polish — execution layout, PR system, gamification foundations | ✅ |
| v2.6.0 | ESLint + code quality | ✅ |
| v2.7.0 | Template library — builder, fork, seeds, session integration | ✅ |
| v2.8.0 | Auto-populate from history + drag reorder + post-session wrap-up | ✅ |
| v2.9.0 | Hosting — Railway + Vercel production deploy | ✅ |
| v2.10.0 | Template builder UX | ✅ |
| v2.11.0 | Session + exercise detail UX | ✅ |
| v2.12.0 | Camera / video capture + coach challenges | ✅ |
| v2.13.0 | Security hardening — CSP, service-worker cache, rate limits | ✅ |
| v2.14.0 | Color system — named palette, semantic tokens, component sweep | ✅ |
| v2.15.0 | Leaderboards + weekly quests + social share | ⏸ Deferred (post-SaaS) |
| v3.0.0 | SaaS — Stripe, subscription billing gates | 🔜 |
| v3.1.0 | Observable navigation — full RxJS swap | 🔜 |

### Unreleased (in flight since v2.14.0)

A large block of work has landed on `main` but isn't tagged yet (full detail in
[`docs/CHANGELOG.md`](./docs/CHANGELOG.md) → _Unreleased_):

- **Training features:** exercise **muscle map** (34-muscle vocab + client-side SVG), **circuits**
  (round-major interwoven exercises), **unilateral / per-side** set tracking, cardio multi-metric +
  `min:sec` entry, per-exercise progress analytics, save-as-template, one-window end-session, delete session.
- **Account & security:** change/reset password, device management, data export, deactivate + 30-day
  purge, change email; security gates — **Fastify 4→5**, **Sentry 8→10**, **G3** real-DB ownership
  matrix, **G16** signed client media, **G17** magic-byte upload typing, **C9** login lockout.
- **Platform:** Sentry + first-party telemetry monitoring (Phase 18), the **Just Train** rebrand, the
  **mode "theme"** refactor (athlete/trainer variance in one registry).

---

## User Types

### Athlete
Tracks their own training. Plans and executes sessions. May have 5 planned sessions open at once (chest day, leg day…). The base user — all trainer features build on top of this.

### Trainer
Everything the athlete has, plus a client roster. Can execute sessions with clients or as themselves. May be planning multiple clients' sessions while in their own workout.

A trainer's `isSelf` client record is their athlete account.

---

## Session Model

Two distinct session types with different UX:

| | Planned | Active |
|---|---|---|
| State | Being built, edited | Executing right now |
| Concurrent | Many open (workspace tabs) | One per person |
| UI language | Editor — calm, structured | Full focus, minimal chrome |

Active session uses the Spotify model: full-screen overlay → swipe down to minimise → persistent pill above nav → nav reappears.

---

## Testing

```bash
pnpm --filter backend test
pnpm --filter backend test:watch
pnpm --filter backend test:coverage
```

---

## Documentation

All project documentation lives in [`./docs`](./docs):

| File | Purpose |
|---|---|
| `DEVELOPER_MANUAL.md` | **Start here as a developer** — onboarding, local setup, verify gate, deploy runbook, docs map |
| `USER_MANUAL.md` | **End-user guide** — how athletes (and trainers) use the app |
| `CONTRIBUTING.md` | Column checklist, exercise join rules, hotfix/release workflow |
| `STYLE_GUIDE.md` | Functional patterns, pre-commit checklist, React/backend conventions |
| `Database-Management.md` | Common SQL for accounts, templates, sessions, exercises, PRs + maintenance/backup |
| `DEPLOYMENT.md` | Railway + Vercel hosting setup, environment variables, troubleshooting |
| `SECURITY.md` | Security assessment, rate limiting, CSP, auth, roadmap |
| `CHANGELOG.md` | Version history |
| `PROJECT_STATE.md` | Current version, roadmap, active spec |
| `DEFERRED_ITEMS.md` | Intentionally deferred features with context |
| `DATA_FLOW.md` | Auth, session, and data flow diagrams |
| `TESTING.md` | Test setup and patterns |
| `GESTURE_GUIDE.md` | Plain-language map of every touch gesture + interaction animation |
| `COLOR_SYSTEM.md` | Named palette, semantic tokens, usage rules (v2.14.0) |
| `RAILWAY_ERRORS.md` | Railway deploy error log + resolutions (CJS/Zod/host-binding) |
