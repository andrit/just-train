-- ------------------------------------------------------------
-- add-trainers-deactivated-at.sql  (account plan A5 — soft delete)
--
-- Additive, idempotent. `deactivated_at` set by DELETE /auth/me; login and
-- refresh are blocked while set; signing in within 30 days clears it; the
-- daily purge job hard-deletes accounts past the window (ordered explicit
-- delete — no FK changes needed).
--
-- Run:  psql "<DATABASE_PUBLIC_URL>" -v ON_ERROR_STOP=1 -P pager=off \
--         -f docs/sql/add-trainers-deactivated-at.sql
-- Drizzle migration generated locally with `cd apps/backend && npx drizzle-kit generate`.
-- ------------------------------------------------------------

ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trainers' AND column_name = 'deactivated_at';
