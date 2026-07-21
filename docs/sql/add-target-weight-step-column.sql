-- TrainerApp — add session_exercises.target_weight_step (weight ramp)
-- 2026-07-21
--
-- Additive, non-destructive. Stores the per-set weight increment for a live ramp
-- (e.g. 50 = raise each set by 50). Only the starting weight (target_weight) and
-- this step are persisted; the expanded per-set values are computed live.
--
-- LOCAL dev: prefer `cd apps/backend && pnpm db:push` (applies the schema directly).
-- PROD (Railway): run this idempotent DDL (get the URL from Railway -> Postgres ->
-- Variables -> DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-target-weight-step-column.sql

ALTER TABLE "session_exercises"
  ADD COLUMN IF NOT EXISTS "target_weight_step" real;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'session_exercises' AND column_name = 'target_weight_step';
