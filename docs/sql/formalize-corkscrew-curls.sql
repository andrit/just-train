-- TrainerApp — formalize "Corkscrew Dumbbell Curls" and absorb the custom draft
-- 2026-10-18
--
-- One file, three jobs, in a single transaction:
--   1. Insert the formal PUBLIC exercise (idempotent — NOT EXISTS on name+is_public).
--   2. Seed its worked muscles (idempotent — ON CONFLICT DO NOTHING).
--   3. Find the trainer's private "cork*" draft(s), repoint every reference
--      (session_exercises, template_exercises, challenges, exercise_media — all
--      ON DELETE RESTRICT) onto the public row, then delete the draft(s).
--
-- Resolution is by NAME, never a hardcoded UUID: the draft is matched by
-- `name ILIKE '%cork%'` AND `trainer_id IS NOT NULL`. A draft that doesn't match
-- is simply left alone — fail-safe. The dry run PRINTS exactly which draft rows
-- matched so you can confirm the match before committing.
--
-- DRY RUN BY DEFAULT: runs inside BEGIN...ROLLBACK and prints the preview +
-- before/after reports, then discards. To APPLY, change the final ROLLBACK -> COMMIT.
--
-- Run against Railway Postgres (URL from Railway -> Postgres -> Variables ->
-- DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/formalize-corkscrew-curls.sql   # dry run

BEGIN;

-- 1. Formal public exercise (arms / isolation / dumbbell, unilateral).
--    Field values match apps/backend/src/db/seeds/exercises-library.json exactly.
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, laterality, is_draft, is_public, trainer_id)
SELECT 'Corkscrew Dumbbell Curls',
       'Dumbbell curl with an exaggerated supination — the wrist ''corkscrews'' outward as you raise, driving the pinky up and in to maximise the biceps contraction.',
       'Start with the dumbbell at your side, palm facing in (neutral). As you curl, rotate the wrist outward so the palm faces up and the little finger turns toward the shoulder at the top. Squeeze, then reverse the rotation on the way down. One arm at a time or alternating; keep the elbow pinned.',
       (SELECT id FROM body_parts WHERE name = 'arms'),
       'resistance', 'dumbbell', 'beginner', 'isolation', 'unilateral', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Corkscrew Dumbbell Curls' AND is_public = true);

-- 2. Worked muscles for the public row (name-keyed, idempotent).
INSERT INTO exercise_muscles (exercise_id, muscle, role)
SELECT e.id, v.muscle, v.role::muscle_role
FROM exercises e
JOIN (VALUES
  ('Corkscrew Dumbbell Curls', 'biceps_brachii', 'primary'),
  ('Corkscrew Dumbbell Curls', 'brachialis',     'secondary'),
  ('Corkscrew Dumbbell Curls', 'brachioradialis','secondary')
) AS v(name, muscle, role) ON e.name = v.name AND e.trainer_id IS NULL
ON CONFLICT (exercise_id, muscle) DO NOTHING;

-- 3a. Resolve the private draft(s) to the public row (by name, fail-safe).
CREATE TEMP TABLE draft_remap ON COMMIT DROP AS
SELECT d.id AS old_id, p.id AS public_id, d.name AS draft_name, d.is_draft, d.trainer_id
FROM exercises d
JOIN exercises p ON p.name = 'Corkscrew Dumbbell Curls' AND p.trainer_id IS NULL
WHERE d.trainer_id IS NOT NULL
  AND d.name ILIKE '%cork%';

-- PREVIEW — confirm these are the draft rows you want absorbed before committing.
-- Expect the custom corkscrew entry you logged against (0 rows = nothing matched;
-- check the exact name you used and widen the pattern if needed).
SELECT draft_name, is_draft, trainer_id, old_id, public_id FROM draft_remap ORDER BY draft_name;

-- How many history rows will be repointed off the draft(s) (before).
SELECT
  (SELECT count(*) FROM session_exercises  WHERE exercise_id IN (SELECT old_id FROM draft_remap)) AS session_exercises,
  (SELECT count(*) FROM template_exercises WHERE exercise_id IN (SELECT old_id FROM draft_remap)) AS template_exercises,
  (SELECT count(*) FROM challenges         WHERE exercise_id IN (SELECT old_id FROM draft_remap)) AS challenges,
  (SELECT count(*) FROM exercise_media     WHERE exercise_id IN (SELECT old_id FROM draft_remap)) AS exercise_media;

-- 3b. Repoint every reference onto the public row, then delete the draft(s).
UPDATE session_exercises  s  SET exercise_id = r.public_id FROM draft_remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.public_id FROM draft_remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.public_id FROM draft_remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.public_id FROM draft_remap r WHERE m.exercise_id  = r.old_id;

DELETE FROM exercises WHERE id IN (SELECT old_id FROM draft_remap);

-- VERIFY — the public row and its 3 muscles exist; no private corkscrew remains.
SELECT e.name, bp.name AS body_part, e.workout_type, e.exercise_category, e.equipment, e.laterality, e.is_public
FROM exercises e LEFT JOIN body_parts bp ON bp.id = e.body_part_id
WHERE e.name = 'Corkscrew Dumbbell Curls';

SELECT em.muscle, em.role
FROM exercise_muscles em
JOIN exercises e ON e.id = em.exercise_id
WHERE e.name = 'Corkscrew Dumbbell Curls' AND e.trainer_id IS NULL
ORDER BY em.role, em.muscle;

SELECT id, name, trainer_id FROM exercises WHERE name ILIKE '%cork%' AND trainer_id IS NOT NULL;  -- expect 0 rows after commit

-- Change ROLLBACK -> COMMIT to apply.
ROLLBACK;
