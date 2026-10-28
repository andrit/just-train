-- TrainerApp — distance-cardio redesign (#21): numeric intensity level + distance unit label
-- 2026-10-27
--
-- Additive, non-destructive. Four nullable columns:
--   sets.intensity_level                      — recorded numeric machine level (spin-bike
--                                                resistance, rower damper, treadmill level).
--   session_exercises.target_intensity_level  — planned numeric machine level.
--   template_exercises.target_intensity_level — planned numeric machine level (template parity).
--   exercises.distance_unit                   — display label for distance ("mi"/"m"/"trips").
-- The existing low/moderate/high `intensity` enum columns are kept (still valid for
-- outdoor/feel efforts); subjective effort stays covered per-set by `rpe`.
--
-- LOCAL dev: prefer `cd apps/backend && pnpm db:push` (applies the schema directly),
-- or `npx drizzle-kit generate` + `npx drizzle-kit migrate`.
-- PROD (Railway): run this idempotent DDL (get the URL from Railway -> Postgres ->
-- Variables -> DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-cardio-intensity-level-and-distance-unit.sql

ALTER TABLE "sets"
  ADD COLUMN IF NOT EXISTS "intensity_level" integer;

ALTER TABLE "session_exercises"
  ADD COLUMN IF NOT EXISTS "target_intensity_level" integer;

ALTER TABLE "template_exercises"
  ADD COLUMN IF NOT EXISTS "target_intensity_level" integer;

ALTER TABLE "exercises"
  ADD COLUMN IF NOT EXISTS "distance_unit" text;

-- Verify
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name = 'sets'               AND column_name = 'intensity_level')
   OR (table_name = 'session_exercises'  AND column_name = 'target_intensity_level')
   OR (table_name = 'template_exercises' AND column_name = 'target_intensity_level')
   OR (table_name = 'exercises'          AND column_name = 'distance_unit')
ORDER BY table_name, column_name;
