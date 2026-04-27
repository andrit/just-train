# TrainerApp — Claude Code Project Memory

> Claude reads this file at the start of every session.
> Keep it factual and concise — conventions, not tutorials.

## What this is

TrainerApp is a mobile-first PWA for fitness trainers and athletes. Progress narrative engine — logging is the input, the output is "Is this client moving forward?" Two user types (trainer mode, athlete mode), one shared infrastructure.

**Current version:** v2.12.0

## Key docs — read before making changes

@./docs/PROJECT_STATE.md
@./docs/STYLE_GUIDE.md
@./docs/CONTRIBUTING.md

## Reference docs — read when relevant

@./docs/CHANGELOG.md
@./docs/DEFERRED_ITEMS.md
@./docs/DEPLOYMENT.md
@./docs/DATA_FLOW.md

## Before deploy changes

@./docs/RAILWAY_ERRORS.md

## Tech stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- State: TanStack Query (server), Zustand (client)
- Backend: Fastify 4, TypeScript, Drizzle ORM, PostgreSQL
- Shared: Zod schemas in `packages/shared/` — compiled to CJS via `tsc -p tsconfig.build.json`
- Auth: JWT access tokens (15min, in-memory) + argon2id + httpOnly refresh cookies (7 day)
- Media: Cloudinary
- Email: Resend
- Queue: BullMQ + Upstash Redis
- Hosting: Railway (backend + Postgres) + Vercel (frontend)

## Critical build rules

1. `packages/shared` has a `prepare` script that compiles to CJS. The `main` field points to `dist/index.js`. Never revert to ESM-only — Railway breaks.
2. Vercel root directory is `apps/frontend` — `vercel.json` must exist there.
3. After any shared package change: `cd packages/shared && pnpm build` then verify both apps typecheck.

## Terminology — use these exactly, never synonyms

- **Session** = single training event
- **Workout** = typed block within a session (resistance, cardio, etc.)
- **Exercise** = named movement in the library
- **Set** = one recorded effort (atomic tracking unit)
- **Template** = reusable session plan
- **Trainer** = app's primary user (never "user" or "coach")
- **Client** = person whose training a Trainer manages
- **Self-client** = Client record representing the Trainer themselves (isSelf=true)
- **Snapshot** = point-in-time measurement capture
- **Challenge** = measurable goal with a deadline

## Code conventions

- Functional over imperative. No classes. Prefer pure functions.
- No `!` non-null assertions — use `??` fallback or guard.
- No `as any` — use proper types or `as unknown as T`.
- Unused variables prefixed with `_`.
- Components never call `apiClient` directly — use query hooks from `lib/queries/`.
- All top-level query hooks must have `enabled: !!accessToken`.
- All animation values in `lib/interactions.ts`.
- Backend logging: always `routeLog(app)`, never `app.log` directly.
- Drizzle: always guard `.returning()` results, never use `!`.

## Adding a column — 4-file checklist (same commit)

1. Schema file (`apps/backend/src/db/schema/`)
2. Serializer function in the route file
3. Response schema in `packages/shared/src/schemas/response-schemas.ts`
4. Test factory in `apps/backend/src/__tests__/helpers/factories.ts`

Also update storybook fixtures if they construct the affected response type inline.

## Adding a preference field

All six files: schema → serializer → response schema → `usePreferences.ts` → `PreferencesPage.tsx` → test factory.

## Git workflow

```bash
# Hotfix (no tag)
./hotfix.sh "fix: description"

# Release (commits, tags, pushes)
./release.sh v2.13.0 "feat: description"
```

## Pre-commit

```
pnpm typecheck
pnpm lint
pnpm test
```

## Active known bug

Refresh token cookie doesn't survive page reload in production (cross-origin Vercel→Railway). Proactive refresh timer (12min) mitigates mid-session logout. Proper fix: Vercel rewrite proxy — see docs/v2.12.0-SCOPE.md Appendix A.
