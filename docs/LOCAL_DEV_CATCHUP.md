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

---

## Applied locally

_(none yet — move rows here with the date applied)_
