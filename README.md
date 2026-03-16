# Trainer App

A mobile-first PWA for professional fitness trainers to plan sessions, track client performance, and build an exercise library.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Frontend    | React 18, Vite, TypeScript, Tailwind CSS        |
| State       | TanStack Query (server), Zustand (client)       |
| PWA         | vite-plugin-pwa, Workbox (Phase 6)              |
| Offline     | IndexedDB (Phase 6)                             |
| Backend     | Fastify, TypeScript                             |
| ORM         | Drizzle + drizzle-kit                           |
| Validation  | Zod (shared between frontend + backend)         |
| Auth        | JWT access tokens + argon2 + httpOnly cookies   |
| Database    | PostgreSQL                                      |
| Media       | Cloudinary (Phase 3)                            |
| Hosting     | Railway (backend + DB), Vercel (frontend)       |

---

## Monorepo Structure

```
trainer-app/
├── packages/
│   └── shared/              # Enums, Zod schemas, TypeScript types, utilities
│       └── src/
│           ├── enums/       # All Zod enums (WorkoutTypeEnum, etc.)
│           ├── schemas/     # Input schemas + response schemas
│           ├── types/       # TypeScript interfaces
│           └── utils/       # weight.ts (convertWeight, formatWeight)
├── apps/
│   ├── backend/             # Fastify API
│   │   └── src/
│   │       ├── db/          # Drizzle client + schema files
│   │       ├── middleware/  # authenticate, requireRole
│   │       ├── routes/      # auth, clients, exercises, sessions, templates
│   │       └── services/    # auth.service.ts (passwords, JWTs, tokens)
│   └── frontend/            # React PWA
│       └── src/
│           ├── components/  # auth/AuthProvider, layout/Layout
│           ├── lib/         # api.ts (HTTP client with auto-refresh)
│           ├── pages/       # Login, Dashboard, Clients, Exercises, Sessions, Templates
│           └── store/       # authStore.ts, sessionStore.ts
└── DEFERRED_ITEMS.md        # Items deferred per phase — reviewed each phase
```

---

## Terminology

| Term         | Meaning                                                  |
|--------------|----------------------------------------------------------|
| **Session**  | A full training event for a client on a date             |
| **Workout**  | A typed block within a session (cardio, resistance, etc.)|
| **Exercise** | A movement in the library (squat, run, stretch)          |
| **Set**      | One recorded effort — the atomic tracking unit           |

Default session order: **Cardio → Stretching → Calisthenics/Resistance → Cooldown** (editable)

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL (local or Railway)

### Install

```bash
git clone <repo>
cd trainer-app
pnpm install
```

### Environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Fill in DATABASE_URL, JWT_SECRET, COOKIE_SECRET

# Generate JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate COOKIE_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database

```bash
cd apps/backend
pnpm db:generate   # Generate migrations from schema
pnpm db:migrate    # Apply migrations to database
pnpm db:studio     # Open Drizzle Studio (visual DB browser)
```

### Run

```bash
# From root — runs both frontend and backend
pnpm dev

# Or individually:
pnpm --filter backend dev    # http://localhost:3001
pnpm --filter frontend dev   # http://localhost:5173
```

### API Documentation

Swagger UI: **http://localhost:3001/documentation**

Click **Authorize 🔒**, enter your JWT from `POST /api/v1/auth/login` to try protected endpoints.

---

## Authentication

Phase 2 implements full JWT auth with refresh token rotation.

| Item                  | Detail                                                     |
|-----------------------|------------------------------------------------------------|
| Password hashing      | argon2id (OWASP recommended)                               |
| Access token          | JWT, 15 min TTL, stored in Zustand memory only             |
| Refresh token         | Opaque random string, 7 days TTL, httpOnly cookie          |
| Token storage         | Access: memory only. Refresh: httpOnly cookie (no JS access)|
| Token rotation        | Refresh token replaced on every use                        |
| Rate limiting         | 10 login attempts per 15 min per IP                        |
| Role guard            | `requireRole('admin')` middleware ready for admin routes   |

See `DEFERRED_ITEMS.md` for items like email verification and password reset.

---

## Build Phases

| Phase | Status | Description                                          |
|-------|--------|------------------------------------------------------|
| 1a    | ✅ Done | Monorepo scaffold, DB schema, API routes, Swagger    |
| 2     | ✅ Done | Auth — JWT, argon2, refresh tokens, rate limiting    |
| 2b    | ✅ Done | Unit tests — auth service, middleware, routes         |
| 3     | ✅ Done | Exercise Library UI — CRUD, media uploads, Cloudinary |
| 3.5   | ✅ Done | Storybook — component library, hooks, cn(), a11y      |
| 3     | 🔜     | Exercise Library UI — CRUD + Cloudinary uploads      |
| 4     | 🔜     | Client Management UI                                 |
| 5     | 🔜     | Session tracking + set logging UI                    |
| 6     | 🔜     | Offline sync — IndexedDB + Workbox background sync   |

---

## CI / CD

GitHub Actions runs on every PR:
1. `pnpm typecheck` — TypeScript across all packages
2. `pnpm lint` — ESLint
3. `pnpm build` — full build verification

See `.github/workflows/ci.yml`.

---

## Testing

See **[TESTING.md](./TESTING.md)** for the full guide.

```bash
pnpm --filter backend test           # run once
pnpm --filter backend test:watch     # watch mode
pnpm --filter backend test:coverage  # with coverage
```

**Test files:** `apps/backend/src/__tests__/`
- `services/auth.service.test.ts` — pure function unit tests (argon2, JWT, tokens)
- `middleware/authenticate.test.ts` — middleware isolation tests
- `routes/auth.test.ts` — auth endpoint integration tests
- `routes/clients.test.ts` — client CRUD + auth/ownership pattern tests
