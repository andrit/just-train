-- ------------------------------------------------------------
-- add-template-exercise-step-and-per-side.sql
--
-- Additive, idempotent. Adds the two session-only planning fields to
-- template_exercises so session -> template -> session round-trips every
-- planning field (Save as template, fork, apply).
--
--   target_weight_step  real     NULL  — per-set weight ramp, mirrors session_exercises
--   track_per_side      boolean  NULL  — tri-state: NULL = inherit from exercise
--                                        laterality on apply (existing behaviour);
--                                        true/false = explicit, copied from a session
--
-- Both nullable: existing rows are untouched and keep today's behaviour.
-- Schema-only (no data mutation), so this runs as a plain statement pair —
-- the BEGIN…ROLLBACK dry-run convention is for data migrations.
--
-- Run:  cd /workspace && psql "<DATABASE_PUBLIC_URL>" -v ON_ERROR_STOP=1 -P pager=off \
--         -f docs/sql/add-template-exercise-step-and-per-side.sql
-- The Drizzle migration for the same change is generated locally with
-- `cd apps/backend && npx drizzle-kit generate` and committed alongside.
-- ------------------------------------------------------------

ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "target_weight_step" real;
ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "track_per_side" boolean;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'template_exercises'
  AND column_name IN ('target_weight_step', 'track_per_side')
ORDER BY column_name;
