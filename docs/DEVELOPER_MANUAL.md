# Developer Manual — Just Train

> Onboarding + operations reference for developers working on the Just Train codebase.
> This is the **map**: it orients you and points to the detailed docs. It is not a copy of them.
> For how to *use* the app, see [`USER_MANUAL.md`](./USER_MANUAL.md).

---

## What this is

**Just Train** (formerly "TrainerApp") is a mobile-first PWA for fitness athletes and trainers — a
"progress narrative engine" where logging is the input and the output answers *"am I moving forward?"*.
Two user types (athlete, trainer) on one shared backend.

- **Frontend:** React 18 + Vite + TypeScript + Tailwind, TanStack Query (server state) + Zustand (client state). Hosted on **Vercel**.
- **Backend:** Fastify 5 + TypeScript + Drizzle ORM + PostgreSQL. Hosted on **Railway**.
- **Shared:** Zod schemas in `packages/shared` (single source of truth for types + validation), compiled to CJS.
- Media: Cloudinary · Email: Resend · Queue: BullMQ + Upstash Redis · Monitoring: Sentry.

Architecture, data model, routes, and the version history live in
[`PROJECT_STATE.md`](./PROJECT_STATE.md) — read it first for the big picture.

---

## Repo layout

```
just-train/
├── packages/shared/     # Zod schemas, enums, types, utils — compiled to CJS (dist/)
├── apps/backend/        # Fastify API (routes/ services/ db/schema/ __tests__/)
└── apps/frontend/       # React PWA (pages/ components/ lib/queries/ store/ hooks/)
```

---

## Local setup

**Prereqs:** Node 20+, pnpm, a local PostgreSQL. (Fresh clone from a zip without a lockfile → run `pnpm install` once to generate it.)

```bash
pnpm install
pnpm --filter @trainer-app/shared build     # REQUIRED before first dev — compiles shared to CJS
cd apps/backend && pnpm db:push && pnpm db:seed && cd ../..   # local schema + exercise/template seed
pnpm dev                                      # frontend + backend together
```

> **Why the explicit shared build:** the `prepare` hook was removed so Railway's production install
> (which skips devDeps) doesn't break `tsc`. Locally, `pnpm dev` uses `tsx` (reads TS directly) so it's
> fine after the one-time build; CI/Railway build shared explicitly.

---

## The verify gate — run before every push

```bash
pnpm verify      # from repo root: shared build → typecheck → all tests → lint, stops at first failure
```

This is the pre-commit gate. Don't run the four steps separately — `verify` chains them in the right
order (shared build first, because typecheck and tests read `packages/shared/dist`).

Individual pieces when iterating:

| Command (from root unless noted) | What |
|---|---|
| `pnpm typecheck` | Typecheck all packages (silence = success) |
| `pnpm lint` | ESLint all packages (`--max-warnings 0`) |
| `pnpm --filter backend test` | Backend unit/route tests (Vitest, mocked DB) |
| `pnpm --filter backend test:db` | **Real-Postgres** ownership matrix (needs `TEST_DATABASE_URL`, db name must contain `test`/`ci`) |
| `pnpm --filter @trainer-app/shared build` | Recompile shared after any schema change |

---

## Conventions (the short list — details in the linked docs)

- **Schemas are the source of truth.** Add a field in `packages/shared` first; never duplicate a type. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **Adding a column** = 4 files in one commit (schema → serializer → response schema → test factory). After any schema change: `npx drizzle-kit generate` and commit the migration. [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **A new `:id` route needs an ownership-matrix line** (`__tests__/db/ownership-matrix.test.ts`) or CI fails. It must return `404` (never `403`/`400`) for another trainer's resource.
- **Components never call `apiClient` directly** — use query hooks in `lib/queries/`. All top-level query hooks carry `enabled: !!accessToken`.
- **Code style:** functional, no classes, no `!` non-null, no `as any`, early returns. Full rules + examples: [`STYLE_GUIDE.md`](./STYLE_GUIDE.md).
- **Colors:** use the named tokens / semantic `surface`/`ink` tokens, not raw hex. [`COLOR_SYSTEM.md`](./COLOR_SYSTEM.md). (A light/dark theme is in progress — new code should use `text-ink*` rather than `text-gray-*`.)
- **Touch interactions:** update [`GESTURE_GUIDE.md`](./GESTURE_GUIDE.md) in the same commit as any gesture/animation change.
- **Charts:** dependency-free inline SVG/HTML (see `components/charts/`); follow the dataviz rules (one hue for magnitude, text in ink tokens).

---

## Git workflow

```bash
./hotfix.sh "fix: description"              # commit, no tag — dev iteration
./release.sh vX.Y.Z "feat: description"     # commit + tag + push — a release
```

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`; `!` for breaking).
`main` auto-deploys: **push to `main` → Vercel builds the frontend and Railway builds the backend.**

---

## Deploy

Full setup (env vars, Vercel proxy, custom domain, migrations) is in [`DEPLOYMENT.md`](./DEPLOYMENT.md).
The essentials:

- **Backend → Railway**, **Frontend → Vercel**, both auto-deploy on push to `main`.
- `/api/*` is proxied by Vercel to Railway (same-origin) — **never set `VITE_API_URL`**; the Railway hostname is hardcoded in `apps/frontend/vercel.json`.
- **Schema changes:** generate a migration (`cd apps/backend && npx drizzle-kit generate`), commit it, and apply to prod with `drizzle-kit migrate` **before** deploying code that reads the new column. Never `db:push` against prod.
- **One-off data SQL** (dedup/backfill/repoint) defaults to a `BEGIN … ROLLBACK` dry-run; flip to `COMMIT` only after the report looks right. See `docs/sql/` for the pattern.

---

## Deploy troubleshooting / runbook

The known-error log and its resolutions live in [`RAILWAY_ERRORS.md`](./RAILWAY_ERRORS.md). Common live cases:

### Railway build fails with **empty logs** (just the "builder" boot banner, nothing after)
That's the **builder crashing before it emits output** — a Railway-side hiccup, not your code. Tells:
Vercel built the same push fine and GitHub CI (which runs the real build + tests) is green. Confirm with
`status.railway.app` for an incident in the failure window.

**Fixing it — the failed deployment usually can't be redeployed** (it crashed before producing an image,
so `railway redeploy` says *"cannot be redeployed / was removed"* and the dashboard shows no Redeploy
button on that deployment). Trigger a **fresh build** instead:

- **`railway up`** — *the no-commit trick.* From the linked service directory, this uploads your local
  source and starts a brand-new build on a fresh builder, without any git commit. Use it when the latest
  deployment is un-redeployable and you don't want to pollute history with an empty commit.
  ```bash
  railway up                      # or: railway up --service <backend-service-name>
  ```
- **Push any commit** — auto-deploy triggers a fresh build too. A real pending commit is ideal; an empty
  one (`git commit --allow-empty -m "chore: trigger Railway rebuild"`) is the last resort.
- **Do NOT** "redeploy the last *successful* deployment" to get unstuck — that re-ships the **older**
  commit's code (e.g. missing newly added routes), so the frontend would call endpoints the deployed
  backend doesn't have.

If a **fresh** build *also* dies with empty logs, it's persistent (e.g. a Nixpacks/"builder v4"
migration), not a flake — check `status.railway.app`, review the `buildCommand` in `railway.json`, and
consider pinning the builder or adding an explicit Dockerfile path.

### Other recurring deploy gotchas
- **`schema.safeParse is not a function`** at runtime → a response schema somewhere is a plain JSON object, not a Zod schema. Every Fastify response schema must be Zod (`fastify-type-provider-zod` serializes globally). See `RAILWAY_ERRORS.md` Error 11.
- **Railway env var "set" but not taking effect** → variable edits are **staged until you click Deploy**; and they belong on the **backend service**, not the Postgres service. `DEPLOYMENT.md` §1c.
- **Frontend fix "didn't work" on device** → the PWA service worker serves the old bundle until two full reopens (`registerType: 'autoUpdate'`). Confirm the Vercel commit check is green, then close/reopen the installed app **twice**. `DEFERRED_ITEMS.md` → "SW Update Strategy".
- **CSS edit passes `tsc`/`eslint` but breaks the Vercel build** ("Unclosed string" from PostCSS) → odd/stray quotes in a CSS comment. `tsc`/`eslint` don't parse CSS; run `postcss.parse` on the file as the CSS gate, and keep apostrophes out of CSS comments.

---

## Docs map

| Doc | For |
|---|---|
| [`PROJECT_STATE.md`](./PROJECT_STATE.md) | Architecture, data model, routes, roadmap, version history — **start here** |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Add-a-column / add-a-preference checklists, TDD rules, gotchas |
| [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) | TypeScript / React / backend code conventions |
| [`COLOR_SYSTEM.md`](./COLOR_SYSTEM.md) | The named palette + semantic tokens |
| [`GESTURE_GUIDE.md`](./GESTURE_GUIDE.md) | Every touch gesture + motion event (plain language) |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Railway + Vercel setup, env vars, migrations, custom domain |
| [`RAILWAY_ERRORS.md`](./RAILWAY_ERRORS.md) | Deploy error log + resolutions |
| [`SECURITY.md`](./SECURITY.md) | Security posture + the pre-Go-Live gate |
| [`TESTING.md`](./TESTING.md) | Test setup, mock patterns, builder helpers |
| [`DATA_FLOW.md`](./DATA_FLOW.md) | End-to-end data flow for major operations |
| [`DEFERRED_ITEMS.md`](./DEFERRED_ITEMS.md) | Everything intentionally deferred, with "when to revisit" |
| [`support-playbook.md`](./support-playbook.md) | Support/ops: failure inventory + FAQ |
| `docs/sql/` | One-off prod SQL (dry-run-by-default pattern) |
| `docs/user-tasks/` | Human runbooks (env setup, smoke tests, monitoring) |

---

_Keep this file current when the setup, verify flow, or deploy runbook changes._
