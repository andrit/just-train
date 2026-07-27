# Local Dev Catch-Up

> Running record of changes made while **not** working locally. When you next spin up
> or refresh the local environment, work through the "Pending" table to bring the local
> DB + seed data current. Move rows to "Applied locally" once done (with the date).

## How to get local current (general)

1. **Start local Postgres** on the port in `apps/backend/.env` (`:5433`), DB `trainer_app`.
   (No `docker-compose` in the repo — use your usual method. User/password must match
   the `DATABASE_URL` in `apps/backend/.env`, which is the `:5433` one, not the root `.env`.)
2. **Schema:** `cd apps/backend && pnpm db:push` — applies the *entire current schema*
   additively, so this covers every schema row in the Pending table at once.
3. **Seed data:** new library exercises are **not** re-seeded automatically — `pnpm db:seed`
   is all-or-nothing (it skips if any public exercise already exists). To pick up new seed
   exercises on an already-seeded local DB, either run the matching `docs/sql/*.sql` insert,
   or delete public exercises and re-seed.

---

## Pending (not yet applied locally)

| Date | Change | Type | Apply locally |
|---|---|---|---|
| 2026-07-21 | `session_exercises.target_weight_step` (weight ramp: per-set increment) | schema | `pnpm db:push` (or `docs/sql/add-target-weight-step-column.sql`) |
| 2026-07-21 | 4 leg/hip exercises — **Good Mornings** + **Hip Flexors (Rotary Machine)** new to seed; Hip Abductors/Adductors already in seed | seed data | `docs/sql/add-hip-leg-exercises.sql` (idempotent), or delete public exercises + `pnpm db:seed` |
| 2026-07-27 | 7 back/shoulder exercises (Pendlay/Yates Row, Overhead Face Pulls, Machine/Diamond Bar Shrugs, Dumbbell Upright Row, Monkey Rows) | seed data | `docs/sql/add-back-shoulder-exercises.sql` (idempotent) |
| 2026-07-27 | Single shared **public** library — prod deduped per-trainer copies into public rows; registration no longer copies the library per trainer | data + code | Local is fine after a fresh `pnpm db:seed` (already seeds public rows). No migration needed locally — the dedup only affected prod's existing per-trainer copies. |

---

## Known divergence — `exercises-library.json` ≠ prod (reconciliation deferred)

**Discovered 2026-07-27.** There were two exercise-seed sources that had drifted apart:
`db/seeds/exercises.ts` (`seedExercises`, reads `exercises-library.json`, **public**) and the
now-deleted `db/seed-exercises.ts` (`seedExerciseLibrary`, a hardcoded 129-name list,
seeded **per-trainer** at registration). Prod's live public library was built from the
**hardcoded list**, so it uses *that* naming (`Pull-up`, `Push-up`, `Chin-up`,
`Mountain Climber`, `Foam Roll Quads`, …).

`exercises-library.json` diverges from prod by ~120 names — ~65 exercises in the old
hardcoded list are absent from the JSON, ~55 JSON names aren't in it, and many pairs are
the *same* exercise under different names/casing. **Net effect:** a fresh `pnpm db:seed`
today builds a library that does **not** match prod (different names + membership).

Prod is correct and is never re-seeded, so this is a **local-dev fidelity** gap only.

**Deferred task — make the JSON mirror prod (source of truth = prod):**
1. Dump prod's public library: `COPY (SELECT name, description, instructions, workout_type, (SELECT name FROM body_parts b WHERE b.id = e.body_part_id) AS body_part, equipment, difficulty, exercise_category FROM exercises e WHERE trainer_id IS NULL ORDER BY name) TO STDOUT WITH CSV HEADER` (or `pg_dump` the `exercises` rows where `trainer_id IS NULL`).
2. Regenerate `exercises-library.json` from that dump so `db:seed` reproduces prod exactly. Note: many prod rows have **null instructions** (the hardcoded list had none) — decide per-row whether to keep prod's null or preserve the richer instruction text the current JSON already has for equivalent exercises.
3. The old hardcoded list is recoverable from git history (`apps/backend/src/db/seed-exercises.ts`, deleted 2026-07-27) if its descriptions are useful during regeneration.

---

## Applied locally

_(none yet — move rows here with the date applied)_
