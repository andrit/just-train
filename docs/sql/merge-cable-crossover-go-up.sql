-- TrainerApp — merge the custom "cable crossover go up" into Low Cable Crossover
-- 2026-10-18
--
-- "cable crossover go up" (low pulleys, pulling up = low-to-high) is a private
-- custom entry that shadows the public "Low Cable Crossover" created by
-- split-cable-crossover.sql. Repoint its history onto the public row, then delete
-- the custom — same repoint-then-delete pattern as formalize-corkscrew-curls.sql.
--
-- Matched by name (ILIKE '%cable crossover%go up%', trainer_id IS NOT NULL), never
-- a UUID — a non-match simply changes nothing (fail-safe). The dry run PRINTS the
-- matched row so you can confirm before committing.
--
-- FK note: the four exercise_id references are ON DELETE RESTRICT — repointed first.
-- DRY RUN BY DEFAULT (BEGIN…ROLLBACK + preview). To APPLY, change ROLLBACK -> COMMIT.
--
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/merge-cable-crossover-go-up.sql

BEGIN;

CREATE TEMP TABLE ccgu_remap ON COMMIT DROP AS
SELECT d.id AS old_id, p.id AS target_id, d.name AS custom_name, d.is_draft, d.trainer_id
FROM exercises d
JOIN exercises p ON p.name = 'Low Cable Crossover' AND p.trainer_id IS NULL
WHERE d.trainer_id IS NOT NULL
  AND d.name ILIKE '%cable crossover%go up%';

-- PREVIEW — confirm this is the custom row to absorb (expect 1 row). 0 rows = the
-- stored name differs; tell me the exact spelling and I'll widen the match.
SELECT custom_name, is_draft, trainer_id, old_id, target_id FROM ccgu_remap;

-- History that will move onto Low Cable Crossover.
SELECT
  (SELECT count(*) FROM session_exercises  WHERE exercise_id IN (SELECT old_id FROM ccgu_remap)) AS session_exercises,
  (SELECT count(*) FROM template_exercises WHERE exercise_id IN (SELECT old_id FROM ccgu_remap)) AS template_exercises,
  (SELECT count(*) FROM challenges         WHERE exercise_id IN (SELECT old_id FROM ccgu_remap)) AS challenges,
  (SELECT count(*) FROM exercise_media     WHERE exercise_id IN (SELECT old_id FROM ccgu_remap)) AS exercise_media;

UPDATE session_exercises  s  SET exercise_id = r.target_id FROM ccgu_remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.target_id FROM ccgu_remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.target_id FROM ccgu_remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.target_id FROM ccgu_remap r WHERE m.exercise_id  = r.old_id;

DELETE FROM exercises WHERE id IN (SELECT old_id FROM ccgu_remap);

-- VERIFY — no private "cable crossover" custom remains.
SELECT id, name, trainer_id FROM exercises WHERE name ILIKE '%cable crossover%' AND trainer_id IS NOT NULL;

-- Change ROLLBACK -> COMMIT to apply.
ROLLBACK;
