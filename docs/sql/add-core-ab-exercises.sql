-- TrainerApp — add core / ab exercises to the public library
-- 2026-10-19
--
-- Adds two NEW exercises (Machine Crunch, Russian Twist) and idempotently
-- ensures two that already exist in exercises-library.json (Crunches, Sit ups)
-- are present in prod's public library — then seeds muscles for all four so the
-- Home body heat-map lights up the core.
--
-- Field values match apps/backend/src/db/seeds/exercises-library.json exactly.
--
-- Idempotent: each exercise row is guarded by NOT EXISTS on (name, is_public),
-- and each muscle row by ON CONFLICT (exercise_id, muscle) DO NOTHING — safe to
-- re-run. Resolved by NAME, never UUID; a name that doesn't match is simply
-- skipped (fail-safe).
--
-- DRY RUN BY DEFAULT: runs inside BEGIN...ROLLBACK and prints before/after
-- counts. To APPLY, change the final ROLLBACK to COMMIT.
--
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-core-ab-exercises.sql   # dry run
--
-- NOTE: prod's public library has drifted from the JSON. If prod already has a
-- crunch/sit-up under a DIFFERENT spelling (e.g. "Crunch", "Sit-Up"), the
-- NAME-guarded insert below will add a second one rather than reusing it —
-- verify the four names against prod before committing.

BEGIN;

SELECT 'before' AS stage,
       (SELECT count(*) FROM exercises WHERE is_public = true) AS public_exercises,
       (SELECT count(*) FROM exercise_muscles) AS exercise_muscles;

-- ── Exercises ────────────────────────────────────────────────────────────────

-- Crunches (calisthenics / core / bodyweight) — ensure present
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Crunches',
       'Foundational core exercise targeting the rectus abdominis by lifting the shoulder blades off the floor while the lower back stays grounded. The feet are lifted and crossed; the smaller range vs a sit-up keeps hip-flexor involvement low and tension on the upper abs.',
       'Lie on your back with knees bent and feet off the ground, ankles crossed. Place hands behind your head or across your chest. Exhale and engage your core to lift your shoulder blades off the floor, keeping your lower back down. Crunch your ribs toward your hips — fold the abs like an accordion — then lower with control without pulling on your neck.',
       (SELECT id FROM body_parts WHERE name = 'core'),
       'calisthenics', 'bodyweight', 'beginner', NULL, false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Crunches' AND is_public = true);

-- Sit ups (calisthenics / core / bodyweight) — ensure present
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Sit ups',
       'Full trunk-flexion core exercise performed with the feet anchored — a larger range than the crunch, bringing the hip flexors in alongside the abs.',
       'Lie on your back with knees bent and feet anchored (tucked under something stable or held). Cross your arms over your chest or lightly behind your head, engage your abs, and exhale as you curl all the way up toward your knees, then lower with control to the floor.',
       (SELECT id FROM body_parts WHERE name = 'core'),
       'calisthenics', 'bodyweight', 'beginner', NULL, false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Sit ups' AND is_public = true);

-- Machine Crunch (resistance / isolation / machine / core) — NEW
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Machine Crunch',
       'Seated weighted crunch on an ab machine. Hooking the arms into the overhead pads loads trunk flexion against a stack — resistance a floor crunch can''t add.',
       'Sit on the ab-crunch machine and set the weight. Hook your arms through the overhead pads or grip the handles so the resistance sits across your upper chest and shoulders. Crunch down by contracting your abs — curl your ribs toward your pelvis — then return under control without letting the stack rest between reps.',
       (SELECT id FROM body_parts WHERE name = 'core'),
       'resistance', 'machine', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Machine Crunch' AND is_public = true);

-- Russian Twist (resistance / isolation / dumbbell / core) — NEW
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Russian Twist',
       'A seated rotational core exercise that targets the obliques. Done holding a weight for load, or with empty hands as a bodyweight movement.',
       'Sit with knees bent and heels on the floor (lift the feet for more difficulty). Lean your torso back to about 45 degrees with a tall spine. Holding a weight at your chest — or empty hands — rotate your torso to bring it toward the floor on one side, then the other. A twist to each side is one rep; move from the waist, not the arms.',
       (SELECT id FROM body_parts WHERE name = 'core'),
       'resistance', 'dumbbell', 'intermediate', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Russian Twist' AND is_public = true);

-- ── Muscles (for the heat-map) ───────────────────────────────────────────────
-- Joined by name to the PUBLIC rows above; ON CONFLICT keeps re-runs clean.
INSERT INTO exercise_muscles (exercise_id, muscle, role)
SELECT e.id, v.muscle, v.role::muscle_role
FROM exercises e
JOIN (VALUES
  ('Crunches',      'rectus_abdominis',      'primary'),
  ('Crunches',      'obliques',              'secondary'),
  ('Sit ups',       'rectus_abdominis',      'primary'),
  ('Sit ups',       'hip_flexors',           'secondary'),
  ('Sit ups',       'obliques',              'secondary'),
  ('Machine Crunch','rectus_abdominis',      'primary'),
  ('Machine Crunch','obliques',              'secondary'),
  ('Russian Twist', 'obliques',              'primary'),
  ('Russian Twist', 'rectus_abdominis',      'secondary'),
  ('Russian Twist', 'transverse_abdominis',  'secondary')
) AS v(name, muscle, role) ON e.name = v.name AND e.is_public = true
ON CONFLICT (exercise_id, muscle) DO NOTHING;

SELECT 'after' AS stage,
       (SELECT count(*) FROM exercises WHERE is_public = true) AS public_exercises,
       (SELECT count(*) FROM exercise_muscles) AS exercise_muscles;

-- Confirm the four are present and carry muscles.
SELECT e.name, e.workout_type, e.exercise_category,
       count(em.*) AS muscles
FROM exercises e
LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
WHERE e.is_public = true
  AND e.name IN ('Crunches', 'Sit ups', 'Machine Crunch', 'Russian Twist')
GROUP BY e.name, e.workout_type, e.exercise_category
ORDER BY e.name;

ROLLBACK;  -- change to COMMIT to apply
