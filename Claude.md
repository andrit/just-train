# TrainerApp — Claude Code Project Memory

> Claude reads this file at the start of every session.
> Keep it factual and concise — conventions, not tutorials.

## What this is

TrainerApp is a mobile-first PWA for fitness trainers and athletes. Progress narrative engine — logging is the input, the output is "Is this client moving forward?" Two user types (trainer mode, athlete mode), one shared infrastructure.

**Current version:** v2.14.0

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

1. `packages/shared` compiles to CJS via `pnpm build`. The `main` field points to `dist/index.js`. Never revert to ESM-only — Railway breaks.
2. Vercel root directory is `apps/frontend` — `vercel.json` must exist there.
3. After any shared package change: `cd packages/shared && pnpm build` then verify both apps typecheck.
4. After a fresh `pnpm install`, run `pnpm --filter @trainer-app/shared build` before starting dev — the `prepare` hook was removed to fix Railway builds (Railway's auto-install runs with NODE_ENV=production, skipping devDeps and breaking `tsc`). The `railway.json` buildCommand handles this explicitly in CI.

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

## Fix quality — always fix the root cause, not the symptom

When something is broken — a failing test, a type error, a runtime bug — find out *why* before touching code.

**Never:**
- Change an assertion to match wrong behavior
- Widen a type (`as any`, union with `unknown`) to silence a complaint
- Add a `try/catch` or `?? null` to hide a crash without understanding its source
- Use a longer timeout to fix a slow operation
- Write test-only code paths (`if (process.env.NODE_ENV === 'test')`)
- Mock a return value in a test that papers over a broken assumption in production code

**Always:**
- Understand why the error occurs before writing a fix
- Fix the code, the setup, or the test infrastructure — whichever is actually wrong
- Prefer using the correct API over adapting to the wrong one (e.g. synchronous `controller` vs async `getRegistration()` when the synchronous check is semantically right)
- Run tests in an environment that matches production as closely as possible (e.g. `vite preview` not `vite dev` for SW tests that depend on the precache manifest)

If you're not sure why something is failing, say so rather than speculating with a patch.

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

## Command directories — run from the correct location

Some commands must be run from a specific directory. Always include the directory when giving instructions.

| Command | Directory | Notes |
|---|---|---|
| `pnpm db:push` | `apps/backend/` | Applies schema changes to the local DB |
| `pnpm db:seed` | `apps/backend/` | Seeds exercises and default templates |
| `pnpm --filter @trainer-app/shared build` | `/workspace` (root) | Compiles shared package to CJS |
| `pnpm typecheck` | `/workspace` (root) | Typechecks all packages |
| `pnpm lint` | `/workspace` (root) | Lints all packages |
| `pnpm --filter backend test` | `/workspace` (root) | Runs backend tests |
| `pnpm dev` | `/workspace` (root) | Starts frontend + backend |
| `./hotfix.sh` | `/workspace` (root) | Git hotfix helper |
| `./release.sh` | `/workspace` (root) | Git release helper |

## Pre-commit

```
# from /workspace (root)
pnpm typecheck
pnpm lint
pnpm test
```

## Production architecture — Vercel proxy (important)

All `/api/*` requests in production route through a Vercel rewrite (see `apps/frontend/vercel.json`) to the Railway backend. This means:
- **Do NOT set `VITE_API_URL` in Vercel** — leave unset so the frontend defaults to `/api/v1` (same-origin via proxy)
- **Hardcode the Railway hostname in `vercel.json`** — Vercel does not substitute user-defined env vars in rewrite destinations; `$RAILWAY_BACKEND_URL` silently fails with DNS_HOSTNAME_NOT_FOUND
- **Set `CORS_ORIGIN`** and **`VERCEL_PROJECT_SLUG`** on Railway — needed for local dev and fallback

Setting `VITE_API_URL` to the Railway URL directly bypasses the proxy → CORS errors + broken refresh cookies.

## Before Making Changes

1. Read the relevant docs first — they contain decisions, context, and constraints
2. Check `docs/project-state.md` for the current inventory and what's been built
3. Verify your plan aligns with the architecture before writing code
4. Ask before making structural changes (new layers, new dependencies, new patterns)
5. Check `docs/skills` to see if there are skills related to teh work that can make it quicker to accurately and efficiently complete the task


## After Each Completed Step

After finishing any numbered step or subtask (e.g. completing 5C, finishing Step 4):

1. Update `docs/CHANGELOG.md` — add version notes
2. Update `docs/PROJECT_STATE.md` — update phases list and deferred items if new ones are added or old ones were completed with this task.
3. If any relevant changes to the Deployment process, Update `docs/DEPLOYMENT.md`
4. Add a task description and explanation with code examples and locations of those code changes to `docs/release-notes/` directory.

Do this before reporting the step as done to the user.


## Create Skill Files for Repeated Patterns

If you find yourself doing the same kind of task more than twice, create a skill file. Skills capture reusable patterns, templates, and checklists so the workbench (and you) can do them consistently.

Skill file locations:
- `/mnt/skills/user/` — user-created skills (read by Claude Code automatically)
- `docs/skills/` — (checked into the repo)

A skill file should include:
- **When to use it** — the trigger conditions
- **Step-by-step process** — the exact actions to take
- **Templates/boilerplate** — code that gets reused each time
- **Checklist** — what to verify when done
- **Files involved** — which files to create or modify


---