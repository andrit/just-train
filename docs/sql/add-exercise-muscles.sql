-- add-exercise-muscles.sql
-- Project 1 (Exercise Muscle Map), Task 1.
-- Adds the muscle vocabulary + the exercise_muscles join table.
-- Additive and idempotent (safe to re-run; safe to run against prod before
-- the code deploy — old code ignores the new table). Not data-mutating, so
-- no ROLLBACK dry-run wrapper (that convention is for data migrations).
--
-- Apply to prod:  psql "$DATABASE_URL" -f docs/sql/add-exercise-muscles.sql
-- Then let `drizzle-kit generate` capture the equivalent migration for the
-- snapshot, and deploy the code.

BEGIN;

-- role is a stable pg enum; muscle is text validated by the Zod MuscleEnum
-- in the app (the anatomical vocabulary is under active refinement, so we
-- avoid ALTER TYPE churn — no `muscle` enum type).
DO $$ BEGIN
  CREATE TYPE muscle_role AS ENUM ('primary', 'secondary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Join table ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_muscles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle      text        NOT NULL,
  role        muscle_role NOT NULL,
  -- The unique index on (exercise_id, muscle) also serves the detail view's
  -- "all muscles for one exercise" lookup (exercise_id is leftmost), so no
  -- separate exercise_id index is needed. Matches the drizzle 0010 migration.
  CONSTRAINT uniq_exercise_muscle UNIQUE (exercise_id, muscle)
);

COMMIT;
