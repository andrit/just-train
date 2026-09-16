# G3 — Real-database ownership matrix (in CI): Task Plan
**Gate:** `docs/SECURITY.md` G3 — "Seed trainer A, call every route as B, expect 404 — against Postgres, not mocks. The guards are scans; this is the proof."
**Written:** 2026-09-16 · **Status:** CONFIRMED (designer, 2026-09-16) after vet — two changes: (1) `drizzle.config.ts` has `strict: true`, which makes `push` prompt → CI hangs; the lane uses its own `drizzle.ci.config.ts` (`strict: false`, reads `TEST_DATABASE_URL`, never the dev URL); (2) seed adds an `exercise_media` row on A's private exercise, and every exercise case uses the *private* id (a public one returns 200 for B legitimately).
**Built 2026-09-16 (tasks 1–6).** Findings while building: both reorder routes returned 403 (fixed → 404); the purge deleted media for exercises it then re-homed, and counted the trainer's own references as "still used" (both fixed, unit + real-DB tests). **First CI run is the designer's to watch** (service readiness, `drizzle-kit push` non-interactive).

## Why CI, not the Mac
The gate row said "needs a test-DB URL on the Mac". A matrix that runs when someone remembers is a status line; one that runs on every push is a gate. GitHub Actions gives a Postgres service container for free, `ci.yml` already sets a `DATABASE_URL` pointing at `localhost:5432/ci_db` (a dummy today, so `pg.Pool` can be imported), and the same URL becomes real once the service exists. Local runs stay possible with `TEST_DATABASE_URL` pointing at a **scratch** database.

## Verified constraints
- `drizzle/0000_baseline.sql` is a placeholder — the chain cannot create a fresh schema. The lane builds the DB with **`drizzle-kit push`** from `db/schema/*` (the authority; also what `pnpm db:push` does locally). On an empty database `push` has no destructive statements, so it is non-interactive (Unknown 1 checks the flag anyway).
- The unit lane mocks `../../db` in every route test; the DB lane must **not** load those mocks. Separate vitest config (`vitest.db.config.ts`, include `src/__tests__/db/**`), and the main config excludes that folder.
- `db/index.ts` creates the `Pool` from `process.env.DATABASE_URL` at import — the DB lane's setup file sets it from `TEST_DATABASE_URL` before anything imports the module, and **refuses to run** if unset or if the URL does not contain `test` / `ci` in the database name (a truncating harness must not be pointable at a dev DB by accident).
- 56 parameterised routes today (list in the matrix file) + the body-id routes from the second sweep (`POST /sessions` clientId; `exerciseId`(s) on add-exercise, circuits, template exercises, challenges; `templateId` on apply).
- Ownership convention: **404, never 403**, for another trainer's resource (`lib/ownership.ts`). The matrix asserts exactly 404 and lists any deliberate exception by name — today I expect none.
- Multipart upload routes (3) resolve ownership **before** parsing the file, so a bodiless request with B's token against A's id must 404, not 400. If one parses first, that is a finding, not a test to relax.

## Design
1. **Lane** — `apps/backend/vitest.db.config.ts` + `src/__tests__/db/setup.ts` (env guard above) + `package.json` script `test:db`. `pnpm test` / `pnpm verify` unchanged (no local-DB assumption). CI runs the lane after the unit lane.
2. **Harness** — `src/__tests__/db/harness.ts`: `resetDatabase()` (TRUNCATE every table CASCADE, from the Drizzle schema so a new table is included automatically), `seedTenants()` → two trainers with real argon hashes (one precomputed constant — hashing 2 passwords per file is fine), each with a self-client; **A** additionally owns: an external client, a goal, a snapshot + snapshot-media row, a private exercise, a session (planned) with one session-exercise + one set + one session-exercise-media row, a template with one template-exercise, a challenge, one refresh-token row (a "device"). Plus one **public** exercise. Returns every id. Tokens via the real `generateAccessToken`.
3. **Matrix** — `src/__tests__/db/ownership-matrix.test.ts`: a table of `{ method, url: (ids) => string, body?: (ids) => unknown }` cases, one per parameterised route, all sent as **B** against **A's** ids, all expected `404`. Bodies are the minimal valid shape so validation (400) cannot mask the check — the same reason G11 exists. A second table for the body-id routes (sent as B with B's own URL resources but A's ids in the body → 404).
4. **Coverage guard** — in the same file: `buildAuditedFullTestApp().routes` filtered to parameterised URLs must equal the matrix's `method + url` set. A new `:id` route without a matrix case fails the lane. (This reuses the audited builder the source-scan guards already use — the DB lane registers the real routes against the real `db`.)
5. **Second real-DB proof, cheap once the seeds exist** — `purge-order.test.ts`: deactivate A, `purgeTrainer(A)`, assert A's rows are gone table by table, **B's rows untouched**, and the RESTRICT-edge claims hold (A's private exercise referenced only by A's session is deleted; a private exercise also referenced by B's session is re-homed to public rather than deleted). The unit test asserts the *order*; this asserts the *outcome* against real foreign keys. Cloudinary mocked (no network).
6. **CI** — `ci.yml`: `services.postgres` (postgres:16, `ci/ci/ci_db`, health check), step *Prepare test database* (`pnpm --filter backend exec drizzle-kit push`), step *Ownership matrix (real DB)* (`pnpm --filter backend test:db`, `TEST_DATABASE_URL` = the existing URL). The dummy `DATABASE_URL` on the unit-test step stays as is.
7. **Docs** — `SECURITY.md` G3 → ✅ with the CI job name as evidence; `TESTING.md` gets the local recipe (`createdb trainer_test`, `TEST_DATABASE_URL=… pnpm --filter backend test:db`); `LOCAL_DEV_CATCHUP.md` note that the lane needs its own database, never the dev one; CHANGELOG.

## Tasks
1. **Lane + env guard** *(low)*. Depends on: none.
2. **Harness: reset + seed** *(medium)* — the seed is the bulk of the work; every table the routes touch must have a row for A. Depends on: 1.
3. **Matrix + coverage guard** *(medium)* — 56 URL cases + ~6 body-id cases. Depends on: 2.
4. **CI service + steps** *(low)*. Depends on: 1 (can be written first; only passes after 3).
5. **Purge-order real-DB test** *(low, optional but recommended)*. Depends on: 2.
6. **Docs** *(low)*. Depends on: 3–4.

## Execution order
1 → 2 → 3 → 4 → 5 → 6. Everything is Claude-side except **verifying the CI run**, which is yours (the first push will show whether `drizzle-kit push` and the service container behave — Unknowns 1–2). No schema, migration, or package change: `drizzle-kit`, `pg` and `vitest` are already dependencies. **No lockfile.**

## Unknowns
1. `drizzle-kit push` (0.21) non-interactivity on an empty DB — expected clean; if it prompts, `--force` is the documented escape and the step gets it.
2. Service-container readiness timing — standard `pg_isready` health options; if the first run flakes, add a wait step.
3. Whether any route returns 403 or 400 instead of 404 for a foreign id — a **finding** to fix in the route, never an accepted variance in the matrix.
4. Multipart routes with no file — expected 404 before the parser runs (see constraints).

## Not in this plan
Running the *unit* lane against the real DB (it is designed around mocks and should stay fast); Playwright; the frontend.
