-- TrainerApp — add the two single-arm cable rotator-cuff exercises to the public
-- library, then transfer the existing history off the custom rows onto them.
-- 2026-08-28
--
-- The movements were logged as custom (trainer-owned) exercises under the names
-- the athlete gave them at the time. This does two things in one transaction:
--   1. inserts the two properly-named public rows (idempotent, guarded on name)
--   2. repoints every reference off the custom rows onto them, then deletes the
--      customs — so all prior sets keep their history under the new names.
--
-- Both are laterality = 'unilateral': single-arm movements, so the live session
-- offers the per-side toggle and defaults trackPerSide to true for NEW work.
--
-- WHAT THIS DOES NOT DO — deliberate. Sets already logged snapshot `per_side` at
-- log time (like weight_unit), and they were recorded bilateral. Repointing does
-- NOT rewrite them, so past sets keep counting reps once while new sets count
-- both sides. Volume for this exercise therefore steps up at the changeover.
-- Rewriting history would double every past set's volume for reps that were
-- entered as a single number — inventing data the athlete never reported. If the
-- step is more annoying than the fabrication, the flip is:
--   UPDATE sets SET per_side = true WHERE session_exercise_id IN (
--     SELECT id FROM session_exercises WHERE exercise_id IN (<new ids>));
-- Left commented out on purpose.
--
-- FK note: session_exercises.exercise_id and template_exercises.exercise_id are
-- ON DELETE RESTRICT, so references are repointed BEFORE the delete.
-- Resolution is by NAME, never hardcoded UUIDs: if a custom row is absent or
-- already merged, it simply isn't remapped or deleted — this fails safe.
--
-- APPLIED TO PROD 2026-08-28. The dry run reported 7 session_exercises and 13 sets
-- moving (4/7 for the rip-up, 3/6 for the pulldown), 0 template/challenge/media
-- references, and a post-state identical to the pre-state — nothing stranded.
-- Safe to re-run: the insert is guarded on name, and with the custom rows already
-- gone the remap matches nothing, so every later statement affects 0 rows.
--
-- Defaults to ROLLBACK (dry run): running as-is prints the inserted rows, the
-- mapping preview, the reference counts being moved, and the post-state, then
-- discards. Change the final ROLLBACK -> COMMIT to apply.
--
-- Run: psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-cable-rotation-exercises.sql

BEGIN;

-- ── 1. Insert the public rows (idempotent — guarded on name) ─────────────────
-- body_part_id is resolved by body_parts.name (a bodyPartEnum) so this does not
-- depend on seed ordering or hardcoded ids. NOTE the category column is named
-- `exercise_category` in the DB even though the Drizzle field is `category`.
INSERT INTO exercises (
  trainer_id, name, body_part_id, workout_type, exercise_category, equipment, difficulty,
  description, instructions, laterality, is_public, is_draft
)
SELECT
  NULL,
  v.name,
  bp.id,
  'resistance',
  'isolation',
  'cable',
  'intermediate',
  v.description,
  v.instructions,
  'unilateral',
  true,
  false
FROM (VALUES
  (
    'Overhead Internal Cable Rotation',
    'Single-arm rotator cuff work from a high pulley. Facing away from the machine, the arm rolls inward toward the midline — targets the subscapularis, the rotator cuff muscle on the front of the shoulder blade, with the chest and lats assisting.',
    'Set the cable at or above head height with a single handle. Face AWAY from the machine and take the handle overhead with one arm, elbow bent and the upper arm roughly at shoulder height. Pull down and forward across the body, rotating the shoulder inward, keeping the elbow bent throughout — the forearm sweeps, the elbow does not travel far. Control the return until the shoulder is fully rotated back. One arm at a time.'
  ),
  (
    'Low External Cable Rotation',
    'Single-arm rotator cuff work from a low pulley — the counterpart to the overhead internal rotation. Facing the machine and driving up and back, the arm rotates away from the midline and the shoulder extends.',
    'Set the cable at or near the floor with a single handle. FACE the machine and take the handle with one arm, palm turned so the back of the hand leads forward. Drive up and back, rotating the shoulder outward and taking the arm behind the body. Keep the torso still — no leaning back to gain range. Control the return. One arm at a time.'
  )
) AS v(name, description, instructions)
CROSS JOIN LATERAL (SELECT id FROM body_parts WHERE name = 'shoulders' LIMIT 1) bp
WHERE NOT EXISTS (
  SELECT 1 FROM exercises e WHERE e.name = v.name AND e.trainer_id IS NULL
);

-- Report what now exists (expect 2 rows, whether inserted now or already present)
SELECT id, name, laterality, is_public
FROM exercises
WHERE name IN ('Overhead Internal Cable Rotation', 'Low External Cable Rotation')
ORDER BY name;

-- ── 2. Map the custom rows onto the new public rows ──────────────────────────
CREATE TEMP TABLE rot_map (custom_name text, public_name text) ON COMMIT DROP;
INSERT INTO rot_map VALUES
  ('overhead rotator cable pulldown', 'Overhead Internal Cable Rotation'),
  ('bottom rotator cable rip up',     'Low External Cable Rotation');

-- Case-insensitive match on the custom side: these were typed by hand mid-session,
-- so capitalisation is not something to bet the migration on.
CREATE TEMP TABLE rot_remap ON COMMIT DROP AS
SELECT c.id AS old_id, p.id AS public_id, c.name AS custom_name, rm.public_name
FROM rot_map rm
JOIN exercises c ON lower(c.name) = rm.custom_name AND c.trainer_id IS NOT NULL
JOIN exercises p ON p.name = rm.public_name AND p.trainer_id IS NULL;

-- Preview the exact mapping (expect 2 rows — if fewer, the custom names differ:
-- check with  SELECT id, name FROM exercises WHERE trainer_id IS NOT NULL;
-- and fix rot_map above rather than forcing anything through)
SELECT custom_name, public_name, old_id, public_id FROM rot_remap ORDER BY custom_name;

-- How much history is about to move (sets are counted via their session_exercise)
SELECT r.custom_name,
       (SELECT count(*) FROM session_exercises se WHERE se.exercise_id = r.old_id) AS session_exercises,
       (SELECT count(*) FROM sets s
          JOIN session_exercises se ON se.id = s.session_exercise_id
         WHERE se.exercise_id = r.old_id)                                          AS sets_logged,
       (SELECT count(*) FROM template_exercises te WHERE te.exercise_id = r.old_id) AS template_exercises
FROM rot_remap r ORDER BY r.custom_name;

-- ── 3. Repoint every reference, then delete the customs ──────────────────────
UPDATE session_exercises  s  SET exercise_id = r.public_id FROM rot_remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.public_id FROM rot_remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.public_id FROM rot_remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.public_id FROM rot_remap r WHERE m.exercise_id  = r.old_id;

DELETE FROM exercises WHERE id IN (SELECT old_id FROM rot_remap);

-- ── 4. Verify ────────────────────────────────────────────────────────────────
-- History now sits under the new names (expect the counts from step 2)
SELECT e.name,
       count(DISTINCT se.id) AS session_exercises,
       count(s.id)           AS sets_logged
FROM exercises e
LEFT JOIN session_exercises se ON se.exercise_id = e.id
LEFT JOIN sets s               ON s.session_exercise_id = se.id
WHERE e.name IN ('Overhead Internal Cable Rotation', 'Low External Cable Rotation')
GROUP BY e.name ORDER BY e.name;

-- Nothing custom should remain under the old names (expect 0 rows)
SELECT id, name, trainer_id FROM exercises
WHERE lower(name) IN ('overhead rotator cable pulldown', 'bottom rotator cable rip up');

-- Change ROLLBACK -> COMMIT to apply. (Already applied to prod 2026-08-28.)
ROLLBACK;
