# TrainerApp

A mobile-first PWA for fitness trainers and athletes to plan sessions, track performance, and build lives around consistent training.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| State | TanStack Query (server), Zustand (client, persisted) |
| PWA | vite-plugin-pwa, Workbox, offline write queue (localStorage → IndexedDB-ready) |
| Backend | Fastify, TypeScript |
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
│       │   ├── schema/       # Drizzle table definitions
│       │   └── seeds/        # Exercise library seed (109 exercises)
│       ├── middleware/       # authenticate, requireRole
│       ├── queues/           # BullMQ workers + scheduler
│       ├── routes/           # auth, clients, exercises, sessions, templates
│       └── services/         # report.service, alert.service
└── apps/frontend/
    └── src/
        ├── components/       # UI components by domain
        ├── hooks/            # usePreferences, useRestTimer, useUXEvent
        ├── lib/              # api.ts, queries/, interactions.ts
        ├── pages/            # Route pages
        └── store/            # authStore, sessionStore
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

pnpm db:push      # apply schema changes (dev)
pnpm db:seed      # seed body parts + 109 public exercises
pnpm db:studio    # open Drizzle Studio visual browser
```

### Run

```bash
# From monorepo root
pnpm dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
# API Docs: http://localhost:3001/documentation
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
2. `pnpm lint` — ESLint (currently no-op, see DEFERRED_ITEMS)
3. `pnpm --filter backend test` — Vitest unit tests
4. `pnpm build` — full build verification

---

## Build Phases

| Version | Description | Status |
|---|---|---|
| v1.0.0 | Scaffold, DB schema, Swagger | ✅ |
| v1.1.0 | Auth — JWT, argon2, refresh tokens | ✅ |
| v1.1.1 | Unit tests — 120 tests | ✅ |
| v1.2.0 | Exercise Library backend + Cloudinary | ✅ |
| v1.3.0 | Client goals, snapshots, self-training schema | ✅ |
| v1.4.0 | Client management UI, onboarding, dashboard | ✅ |
| v1.4.5 | Preferences screen | ✅ |
| v1.5.0 | Session logging — launcher, live session, summary | ✅ |
| v1.6.0 | KPI dashboard | ✅ |
| v1.7.0 | Monthly reports via Resend | ✅ |
| v1.7.5 | BullMQ + Upstash Redis — scheduled reports + at-risk alerts | ✅ |
| v1.8.0 | Live session: add blocks, exercises, set logging, session store | ✅ |
| **v1.9.0** | **Exercise library UI** | 🔨 Current |
| v2.0.0 | SPA refactor — panels, overlays, persistent session | ✅ |
| v2.1.0 | Session planning — "plan the day" workflow | ✅ |
| v2.2.0 | Sessions view — history list | ✅ |
| v2.3.0 | Nav event bus — debouncing, audit log, RxJS-ready | ✅ |
| v2.4.0 | Offline sync — write queue, prefetch, banner | ✅ |
| v2.5.0 | UI/UX polish — execution layout, PR system, gamification | ✅ |
| v2.6.0 | ESLint + code quality | ✅ |
| v2.7.0 | Template library — builder, fork, seeds, session integration | ✅ |
| v2.8.0 | Camera / video capture + coach challenges | 🔜 |
| v2.9.0 | Leaderboards + quests + social share | 🔜 |
| v3.0.0 | SaaS — Stripe, subscription billing gates | 🔜 |
| v3.1.0 | Observable navigation — full RxJS swap | 🔜 |
| v3.0.0 | SaaS — Stripe, subscription billing gates | 🔜 |

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
