-- TrainerApp — split "Cable Crossover" into High / Middle / Low variants
-- 2026-10-18
--
-- The single public "Cable Crossover" becomes three public exercises that differ
-- by pulley height:
--   High Cable Crossover   — cables high, pull down-and-across (lower/sternal pec)
--   Middle Cable Crossover — cables at shoulder height, pull straight across (mid pec)
--   Low Cable Crossover    — cables low, pull up-and-across (upper/clavicular pec)
--
-- Per the user: existing history logged against the generic "Cable Crossover" is
-- repointed to LOW Cable Crossover, then the generic is deleted. (All three map to
-- the same muscle REGION — pectoralis_major — the 34-muscle vocab has no separate
-- upper/lower-pec region, so the angle distinction lives in the name/description.)
--
-- FK note: session_exercises / template_exercises / challenges / exercise_media
-- exercise_id are ON DELETE RESTRICT, so references are repointed before the delete.
-- Prod-only (like the other net-new exercises) — exercises-library.json is not
-- touched; full JSON<->prod reconciliation stays its own deferred item.
--
-- DRY RUN BY DEFAULT (BEGIN…ROLLBACK + preview). To APPLY, change ROLLBACK -> COMMIT.
-- Idempotent inserts (NOT EXISTS / ON CONFLICT); resolved by name, never UUID.
--
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/split-cable-crossover.sql

BEGIN;

-- 1. The three variants (resistance / isolation / cable / chest, bilateral).
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'High Cable Crossover',
       'Cable fly with both pulleys set high, drawing the handles down and across to meet in front of the hips. Biases the lower/sternal chest.',
       'Set both pulleys above head height. With a slight forward lean and soft elbows, bring the handles down and together in front of your hips, squeezing the chest. Return under control.',
       (SELECT id FROM body_parts WHERE name = 'chest'),
       'resistance', 'cable', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'High Cable Crossover' AND is_public = true);

INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Middle Cable Crossover',
       'Cable fly with both pulleys at shoulder height, drawing the handles straight across parallel to the floor. Biases the mid chest.',
       'Set both pulleys at roughly shoulder height. With soft elbows, bring the handles together straight out in front of your chest, squeezing at the midline. Return under control.',
       (SELECT id FROM body_parts WHERE name = 'chest'),
       'resistance', 'cable', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Middle Cable Crossover' AND is_public = true);

INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Low Cable Crossover',
       'Cable fly with both pulleys set low, drawing the handles up and across to meet in front of the chest. Biases the upper/clavicular chest.',
       'Set both pulleys near the floor. With a slight backward lean and soft elbows, sweep the handles up and together in front of your upper chest/chin, squeezing the chest. Return under control.',
       (SELECT id FROM body_parts WHERE name = 'chest'),
       'resistance', 'cable', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Low Cable Crossover' AND is_public = true);

-- 2. Muscles for the three (name-keyed, idempotent).
INSERT INTO exercise_muscles (exercise_id, muscle, role)
SELECT e.id, v.muscle, v.role::muscle_role
FROM exercises e
JOIN (VALUES
  ('High Cable Crossover',   'pectoralis_major', 'primary'),
  ('High Cable Crossover',   'deltoid_anterior', 'secondary'),
  ('Middle Cable Crossover', 'pectoralis_major', 'primary'),
  ('Middle Cable Crossover', 'deltoid_anterior', 'secondary'),
  ('Low Cable Crossover',    'pectoralis_major', 'primary'),
  ('Low Cable Crossover',    'deltoid_anterior', 'secondary')
) AS v(name, muscle, role) ON e.name = v.name AND e.trainer_id IS NULL
ON CONFLICT (exercise_id, muscle) DO NOTHING;

-- 3. Repoint the generic's history to Low, then delete the generic.
CREATE TEMP TABLE cc_remap ON COMMIT DROP AS
SELECT old.id AS old_id, low.id AS target_id
FROM exercises old
JOIN exercises low ON low.name = 'Low Cable Crossover' AND low.trainer_id IS NULL
WHERE old.name = 'Cable Crossover' AND old.trainer_id IS NULL;

-- PREVIEW — the generic -> Low mapping and how much history moves (expect 1 row).
SELECT old_id, target_id FROM cc_remap;
SELECT
  (SELECT count(*) FROM session_exercises  WHERE exercise_id IN (SELECT old_id FROM cc_remap)) AS session_exercises,
  (SELECT count(*) FROM template_exercises WHERE exercise_id IN (SELECT old_id FROM cc_remap)) AS template_exercises,
  (SELECT count(*) FROM challenges         WHERE exercise_id IN (SELECT old_id FROM cc_remap)) AS challenges,
  (SELECT count(*) FROM exercise_media     WHERE exercise_id IN (SELECT old_id FROM cc_remap)) AS exercise_media;

UPDATE session_exercises  s  SET exercise_id = r.target_id FROM cc_remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.target_id FROM cc_remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.target_id FROM cc_remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.target_id FROM cc_remap r WHERE m.exercise_id  = r.old_id;

DELETE FROM exercises WHERE id IN (SELECT old_id FROM cc_remap);

-- VERIFY — three variants exist with 2 muscles each; no generic remains.
SELECT e.name, bp.name AS body_part, e.workout_type, e.exercise_category, e.equipment,
       count(em.id) AS muscle_rows
FROM exercises e
LEFT JOIN body_parts bp ON bp.id = e.body_part_id
LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
WHERE e.name IN ('High Cable Crossover','Middle Cable Crossover','Low Cable Crossover','Cable Crossover')
  AND e.is_public = true
GROUP BY e.name, bp.name, e.workout_type, e.exercise_category, e.equipment
ORDER BY e.name;

-- Change ROLLBACK -> COMMIT to apply.
ROLLBACK;
