-- TrainerApp — add 4 leg/hip exercises to the public library
-- 2026-07-21
--
-- Idempotent: each row is guarded by NOT EXISTS on (name, is_public), so this is
-- safe to run more than once and will only insert rows prod is actually missing.
-- Field values match apps/backend/src/db/seeds/exercises-library.json exactly.
--
-- Run against Railway Postgres (get the URL from Railway -> Postgres -> Variables
-- -> DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-hip-leg-exercises.sql

-- Good Mornings (resistance / compound)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Good Mornings',
       'A hip-hinge that loads the hamstrings, glutes, and lower back. Builds posterior-chain strength and reinforces the hip-hinge pattern used in deadlifts and cleans.',
       'Rest a barbell across your upper back as in a back squat. With a soft bend in the knees, hinge at the hips and lower your torso toward parallel, keeping a flat back and the bar tracking over your midfoot. Drive the hips forward to return to standing.',
       (SELECT id FROM body_parts WHERE name = 'legs'),
       'resistance', 'barbell', 'intermediate', 'compound', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Good Mornings' AND is_public = true);

-- Hip Abductors (resistance / isolation / machine)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Hip Abductors',
       'a seated isolation exercise designed to strengthen the outer hips and glutes by forcing the legs apart against resistance. It effectively targets the gluteus medius, minimus, and tensor fasciae latae (TFL) to improve pelvic stability, enhance hip strength, and shape the outer thighs.',
       'Sit with your back against the pad, feet on the rests, and knees against the pads. Push outward slowly, hold for 1-2 seconds, and return to center without letting the weights touch.',
       (SELECT id FROM body_parts WHERE name = 'legs'),
       'resistance', 'machine', 'intermediate', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Hip Abductors' AND is_public = true);

-- Hip Adductors (resistance / isolation / machine)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Hip Adductors',
       'a seated, isolation exercise designed to strengthen the inner thigh muscles (adductors) by bringing the legs toward the body''s midline against resistance. It targets the adductor magnus, longus, and gracilis, improving hip stability and enhancing lower body strength for compound movements like squats.',
       'Sit with your back against the pad, adjust the knee pads to the outside, and place your feet on the rest. Squeeze your thighs together against the pads in a controlled, slow motion until they almost touch, then slowly return to the starting position.',
       (SELECT id FROM body_parts WHERE name = 'legs'),
       'resistance', 'machine', 'intermediate', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Hip Adductors' AND is_public = true);

-- Hip Flexors (Rotary Machine) (resistance / isolation / machine)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Hip Flexors (Rotary Machine)',
       'A standing rotary-hip (multi-hip) machine movement that isolates the hip flexors by driving the working thigh forward and up against resistance. Strengthens the iliopsoas and rectus femoris for knee drive and sprint mechanics.',
       'Stand in the rotary hip machine with the pad against the front of the working thigh and hold the support handles. Drive your knee forward and up against the resistance, pause briefly at the top, then lower under control. Finish the set, then switch to the other leg.',
       (SELECT id FROM body_parts WHERE name = 'legs'),
       'resistance', 'machine', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Hip Flexors (Rotary Machine)' AND is_public = true);

-- Verify
SELECT name, workout_type, exercise_category, equipment, difficulty
FROM exercises
WHERE name IN ('Good Mornings','Hip Abductors','Hip Adductors','Hip Flexors (Rotary Machine)')
  AND is_public = true
ORDER BY name;
