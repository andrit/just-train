-- TrainerApp — add back & shoulder exercises to the public library
-- 2026-07-26
--
-- Idempotent: each row is guarded by NOT EXISTS on (name, is_public), so this is
-- safe to run more than once and will only insert rows prod is actually missing.
-- Field values match apps/backend/src/db/seeds/exercises-library.json exactly.
--
-- Run against Railway Postgres (get the URL from Railway -> Postgres -> Variables
-- -> DATABASE_PUBLIC_URL; do NOT save it to a file):
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-back-shoulder-exercises.sql

-- Pendlay Row (resistance / compound / barbell / back)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Pendlay Row',
       'An explosive barbell row performed from a dead stop on the floor each rep. Builds mid-back thickness and reinforces a strong, flat-backed hinge.',
       'Set the bar on the floor over your midfoot. Hinge until your torso is roughly parallel to the ground with a flat back. Pull the bar explosively to your lower chest/upper abdomen, then return it to the floor and reset before each rep.',
       (SELECT id FROM body_parts WHERE name = 'back'),
       'resistance', 'barbell', 'intermediate', 'compound', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Pendlay Row' AND is_public = true);

-- Yates Row (resistance / compound / barbell / back)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Yates Row',
       'An underhand-grip barbell row done with a more upright torso (~45 degrees), popularized by Dorian Yates. Emphasizes the lower lats and biceps with heavier loads.',
       'Grip the bar underhand, slightly wider than shoulder width. Hinge to about a 45-degree torso angle with a flat back. Drive the bar toward your waistline, keeping elbows close to the body, then lower under control.',
       (SELECT id FROM body_parts WHERE name = 'back'),
       'resistance', 'barbell', 'intermediate', 'compound', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Yates Row' AND is_public = true);

-- Overhead Face Pulls (resistance / isolation / cable / back)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Overhead Face Pulls',
       'A face pull performed with the cable set overhead, pulling down and apart. Targets the rear delts and upper-back rotators for posture and shoulder health.',
       'Set a cable with a rope attachment above head height. Grip the rope with palms facing in and step back into tension. Pull the rope down and toward your forehead, driving the elbows down and out and externally rotating at the end. Return under control.',
       (SELECT id FROM body_parts WHERE name = 'back'),
       'resistance', 'cable', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Overhead Face Pulls' AND is_public = true);

-- Machine Shrugs (resistance / isolation / machine / back)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Machine Shrugs',
       'A trap-focused shrug performed on a machine, which fixes the movement path and lets you load the upper traps with minimal grip demand.',
       'Grip the handles or rest your shoulders under the pads. Keeping the arms straight, elevate your shoulders straight up toward your ears, pause and squeeze at the top, then lower under control. Avoid rolling the shoulders.',
       (SELECT id FROM body_parts WHERE name = 'back'),
       'resistance', 'machine', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Machine Shrugs' AND is_public = true);

-- Diamond Bar Shrugs (resistance / isolation / barbell / back)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Diamond Bar Shrugs',
       'A shrug performed with a diamond (hex/trap) bar, so the load sits at your sides for a neutral, spine-friendly line of pull on the upper traps.',
       'Stand inside a loaded diamond/trap bar and grip the neutral handles. With arms straight and a tall chest, elevate your shoulders straight up toward your ears, squeeze at the top, then lower under control.',
       (SELECT id FROM body_parts WHERE name = 'back'),
       'resistance', 'barbell', 'beginner', 'isolation', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Diamond Bar Shrugs' AND is_public = true);

-- Dumbbell Upright Row (resistance / compound / dumbbell / shoulders)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Dumbbell Upright Row',
       'A vertical pull that targets the lateral delts and traps. Multi-joint through the shoulder and elbow.',
       'Hold a dumbbell in each hand in front of your thighs, palms facing you. Pull the dumbbells straight up along the body, leading with the elbows until the upper arms are roughly parallel to the floor. Keep the elbows above the wrists, then lower under control. Avoid pulling too high if it causes shoulder pinching.',
       (SELECT id FROM body_parts WHERE name = 'shoulders'),
       'resistance', 'dumbbell', 'intermediate', 'compound', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Dumbbell Upright Row' AND is_public = true);

-- Monkey Rows (resistance / compound / dumbbell / shoulders)
INSERT INTO exercises (name, description, instructions, body_part_id, workout_type, equipment, difficulty, exercise_category, is_draft, is_public, trainer_id)
SELECT 'Monkey Rows',
       'A wide dumbbell upright-row variant that drives the elbows high and out to the sides, biasing the lateral delts and traps.',
       'Hold a dumbbell in each hand in front of your thighs, palms facing your body. Pull the dumbbells up close to the torso toward the chest, flaring your elbows high and out to the sides (wider than a standard upright row). Pause at the top with the elbows above the hands, then lower under control.',
       (SELECT id FROM body_parts WHERE name = 'shoulders'),
       'resistance', 'dumbbell', 'intermediate', 'compound', false, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Monkey Rows' AND is_public = true);

-- Reclassify the existing public Face Pull from shoulders -> back (it is a trap/upper-back movement).
-- Idempotent: only updates the public row and only when it is not already on 'back'.
UPDATE exercises
SET body_part_id = (SELECT id FROM body_parts WHERE name = 'back')
WHERE name = 'Face Pull'
  AND is_public = true
  AND body_part_id IS DISTINCT FROM (SELECT id FROM body_parts WHERE name = 'back');

-- Verify
SELECT e.name, bp.name AS body_part, e.workout_type, e.exercise_category, e.equipment, e.difficulty
FROM exercises e
LEFT JOIN body_parts bp ON bp.id = e.body_part_id
WHERE e.name IN ('Pendlay Row','Yates Row','Overhead Face Pulls','Machine Shrugs','Diamond Bar Shrugs','Dumbbell Upright Row','Monkey Rows','Face Pull')
  AND e.is_public = true
ORDER BY e.name;
