-- TrainerApp — flag unilateral (single-limb) exercises in the library
-- 2026-08-05
--
-- Sets exercises.laterality = 'unilateral' for the 12 movements trained one
-- side at a time (Bulgarian split squat, lunges, single-arm row, dumbbell
-- curls, etc.). Everything else keeps the column default 'bilateral' — this
-- script only flips the unilateral set.
--
-- PREREQUISITE: the laterality column must already exist on prod. Apply the
-- generated Drizzle migration first (CREATE TYPE laterality + ADD COLUMN):
--   cd apps/backend && DATABASE_URL="<prod>" npx drizzle-kit migrate
--
-- SAFE BY DEFAULT — this file is a DRY RUN as written. It runs inside a single
-- BEGIN … ROLLBACK, so running it prints the before/after report and changes
-- nothing. To APPLY: read the report, confirm the matched/unmatched lists look
-- right, then change the final ROLLBACK; to COMMIT; and re-run.
--
-- Matching is by lower(name) so casing drift (Pull-up vs Pull-Up) is tolerated,
-- and any target name NOT present in prod simply matches 0 rows and is skipped
-- (fail-safe) — the unmatched report calls those out.
--
-- Run against Railway Postgres (get the URL from Railway -> Postgres -> Variables
-- -> DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/set-exercise-laterality.sql

BEGIN;

-- The approved unilateral movements, resolved to PROD's actual names
-- (lowercased for case-insensitive match). Prod names differ from the seed
-- JSON: the "Lunges"/"Barbell Lunges" concept maps to Dumbbell/Barbell/Reverse
-- Lunge (all per-leg), and prod has no "Glute Kickback" (only "Glute Bridge",
-- which is bilateral and correctly excluded). Tricep Kickback (single-arm
-- dumbbell) takes that slot instead.
CREATE TEMP TABLE _uni(name text) ON COMMIT DROP;
INSERT INTO _uni(name) VALUES
  ('bulgarian split squat'),
  ('dumbbell lunge'),
  ('barbell lunge'),
  ('reverse lunge'),
  ('dumbbell row'),
  ('dumbbell curl'),
  ('hammer curl'),
  ('tricep kickback'),
  ('pallof press'),
  ('hip flexors (rotary machine)'),
  ('side plank'),
  ('dumbbell front raise'),
  ('dumbbell shoulder press');

-- ── REPORT 1 — target → how many rows match in prod (0 = not present, skipped) ──
SELECT u.name AS target, COUNT(e.id) AS matches
FROM _uni u
LEFT JOIN exercises e ON lower(e.name) = u.name
GROUP BY u.name
ORDER BY matches ASC, u.name;

-- ── REPORT 2 — before: current laterality of every matching row ────────────────
SELECT e.name, e.laterality, e.is_public, e.trainer_id
FROM exercises e
WHERE lower(e.name) IN (SELECT name FROM _uni)
ORDER BY e.name;

-- ── THE UPDATE — only flips rows currently bilateral ───────────────────────────
UPDATE exercises
SET laterality = 'unilateral'
WHERE laterality = 'bilateral'
  AND lower(name) IN (SELECT name FROM _uni);

-- ── REPORT 3 — after: the full unilateral set (should be the 12 above) ─────────
SELECT name, laterality, is_public, trainer_id
FROM exercises
WHERE laterality = 'unilateral'
ORDER BY name;

-- Dry run: discard. Change to COMMIT; only after the reports look right.
ROLLBACK;
