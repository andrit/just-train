# TrainerApp

A mobile-first PWA for fitness trainers and athletes to plan sessions, track performance, and build an exercise library.

---

## Tech Stack

| Layer    | Technology                                    |
|----------|-----------------------------------------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS      |
| State    | TanStack Query (server), Zustand (client)     |
| PWA      | vite-plugin-pwa, Workbox (Phase 8)            |
| Offline  | IndexedDB (Phase 8)                           |
| Backend  | Fastify, TypeScript                           |
| ORM      | Drizzle + drizzle-kit                         |
| Validation | Zod (shared between frontend + backend)     |
| Auth     | JWT access tokens + argon2 + httpOnly cookies |
| Database | PostgreSQL                                    |
| Media    | Cloudinary                                    |
| Hosting  | Railway (backend + DB), Vercel (frontend) | Split by design — Vercel CDN for PWA load speed, Railway for API + Postgres co-location |

---

## Monorepo Structure

```
trainer-app/
├── packages/shared/          # Enums, Zod schemas, TypeScript types, utilities
├── apps/backend/             # Fastify API
│   └── src/
│       ├── db/               # Drizzle client + schema files
│       ├── middleware/       # authenticate, requireRole
│       ├── routes/           # auth, clients, exercises, sessions, templates
│       └── services/         # auth.service.ts
└── apps/frontend/            # React PWA
    └── src/
        ├── components/       # UI components, dashboard widgets, session components
        ├── hooks/            # usePreferences, useUXEvent, useRestTimer, useReorderList
        ├── lib/              # api.ts, queries/, interactions.ts, ux-events.ts, widgets.ts
        ├── pages/            # All route pages
        └── store/            # authStore.ts
```

---

## Terminology

| Term        | Meaning                                                   |
|-------------|-----------------------------------------------------------|
| **Session** | A full training event for a client on a date              |
| **Workout** | A typed block within a session (cardio, resistance, etc.) |
| **Exercise**| A movement in the library                                 |
| **Set**     | One recorded effort — the atomic tracking unit            |

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

# Generate secrets:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Database

**Development (recommended):**
```bash
cd apps/backend
pnpm db:push      # apply schema directly — no migration files needed
```

**Production / new installs:**
```bash
cd apps/backend
pnpm db:generate  # generate migration SQL from schema
pnpm db:migrate   # apply migrations to database
```

> **Note:** If you see "column X does not exist" errors after adding schema changes,
> run `dropdb trainer_app && createdb trainer_app` then `pnpm db:migrate` to apply
> the full schema to a fresh database. This is safe during development — no real data
> is lost.

### Run

```bash
# From monorepo root — runs both frontend and backend
pnpm dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
# API Docs: http://localhost:3001/documentation
```

---

## Git Workflow

### First-time setup
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git add .
git commit -m "feat: TrainerApp v1.5.0 — session logging"
git tag v1.5.0
git push -u origin main --tags
```

### Updating to a new version
```bash
# 1. Unzip new version over the existing repo folder
unzip -o TrainerApp-v1.5.1.zip -d .

# 2. Apply any database schema changes
cd apps/backend && pnpm db:push && cd ../..

# 3. Commit and push
chmod +x release.sh
./release.sh v1.5.1 "feat: UX event side effects"
```

### release.sh
One command to commit, tag, and push:
```bash
./release.sh v1.5.1 "feat: description"
```

---

## CI / CD

GitHub Actions runs on every push to `main`:
1. `pnpm typecheck` — TypeScript across all packages
2. `pnpm lint` — ESLint
3. `pnpm --filter backend test` — Vitest unit tests
4. `pnpm build` — full build verification

See `.github/workflows/ci.yml`.

---

## Build Phases

| Version | Description                                         | Status  |
|---------|-----------------------------------------------------|---------|
| v1.0.0  | Scaffold, DB schema, Swagger                        | ✅ Done |
| v1.1.0  | Auth — JWT, argon2, refresh tokens                  | ✅ Done |
| v1.1.1  | Unit tests — 120 tests                              | ✅ Done |
| v1.2.0  | Exercise Library UI + Cloudinary                    | ✅ Done |
| v1.2.1  | Storybook component library                         | ✅ Done |
| v1.3.0  | Client goals, snapshots, self-training schema       | ✅ Done |
| v1.3.1  | Usage metrics, trainerMode, onboarding schema       | ✅ Done |
| v1.4.0  | Client management UI, onboarding screen             | ✅ Done |
| v1.4.1  | Preference schema (ctaLabel, widgets, alerts)       | ✅ Done |
| v1.4.2  | Dashboard with widget system                        | ✅ Done |
| v1.4.3  | Storybook — Phase 4 components                      | ✅ Done |
| v1.4.4  | UX event system                                     | ✅ Done |
| v1.4.5  | Preferences screen                                  | ✅ Done |
| v1.5.0  | Session logging — launcher, live session, summary   | ✅ Done |
| v1.5.1  | Session history + client timeline                   | 🔜 Next |
| v1.6.0  | KPI dashboard                                       | 🔜      |
| v1.7.0  | Monthly reports (Resend email)                      | 🔜      |
| v1.8.0  | Offline sync — IndexedDB + Workbox                  | 🔜      |

---

## Testing

```bash
pnpm --filter backend test           # run once
pnpm --filter backend test:watch     # watch mode
pnpm --filter backend test:coverage  # with coverage
```

See `DEFERRED_ITEMS.md` for deferred features per phase.
