-- TrainerApp — exercise muscle-map coverage check (READ ONLY)
-- 2026-10-18
--
-- Lists every PUBLIC exercise (trainer_id IS NULL) with how many exercise_muscles
-- rows it has, lowest first — so the exercises still MISSING muscle data (count 0)
-- float to the top. Used to find the name-drift misses left by seed-exercise-muscles.sql
-- (prod's public names were built from the old hardcoded library, so some don't match
-- the names the seed is keyed on).
--
-- Cardio and breathing/savasana/walking are EXPECTED to have 0 (no meaningful highlight).
-- The real misses are resistance / calisthenics / stretching / cooldown rows with 0.
--
-- No transaction needed — it writes nothing.
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/check-exercise-muscle-coverage.sql

-- Summary: how many public exercises have muscle data vs none.
SELECT
  count(*)                                   AS public_exercises,
  count(*) FILTER (WHERE mc.n > 0)           AS with_muscles,
  count(*) FILTER (WHERE mc.n = 0)           AS without_muscles
FROM (
  SELECT e.id, count(em.id) AS n
  FROM exercises e
  LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
  WHERE e.trainer_id IS NULL
  GROUP BY e.id
) mc;

-- Per-exercise coverage, misses (0 rows) first. workout_type/exercise_category
-- included so the mapping back to muscle sets is unambiguous.
SELECT e.name, e.workout_type, e.exercise_category, count(em.id) AS muscle_rows
FROM exercises e
LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
WHERE e.trainer_id IS NULL
GROUP BY e.name, e.workout_type, e.exercise_category
ORDER BY muscle_rows ASC, e.name ASC;
