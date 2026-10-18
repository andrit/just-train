-- TrainerApp — exercise muscle-map coverage TOP-UP (name drift + net-new)
-- 2026-10-18
--
-- seed-exercise-muscles.sql matched only 67 of prod's 141 public exercises,
-- because prod's public names were built from the old hardcoded library and the
-- seed is keyed on the exercises-library.json names. This file adds muscle data
-- for the 58 public exercises that were missed — keyed on PROD'S ACTUAL NAMES
-- (taken verbatim from check-exercise-muscle-coverage.sql output).
--
-- Two causes covered: (1) spelling drift (prod 'Chin-up' vs seeded 'Chin-Up',
-- 'Diamond Push-up' vs 'Diamond Push-Up', 'Cross-body Shoulder Stretch' vs
-- 'Cross Body Shoulder Stretch', 'Front Squat' vs 'Barbell Front Squat', …) and
-- (2) exercises prod has that were never authored (Cable Curl, Sumo Deadlift,
-- Close-Grip Bench Press, T-Bar Row, foam-roll variants, …).
--
-- DELIBERATELY NOT HERE:
--   * Cable Crossover — being split into High/Middle/Low (separate workflow).
--   * Box Breathing, Slow Treadmill Walk — breathing/walking, no meaningful
--     highlight (correctly empty, like cardio).
--
-- Idempotent (ON CONFLICT (exercise_id, muscle) DO NOTHING) and additive — safe
-- to re-run; it never touches the 67 that already landed. DRY RUN BY DEFAULT
-- (BEGIN…ROLLBACK + before/after coverage). To APPLY, change ROLLBACK -> COMMIT.
--
-- The canonical seed (seed-exercise-muscles.sql) is NOT updated to match prod
-- names — that rides on the deferred "reconcile exercises-library.json to prod"
-- item; this file is the prod-targeted top-up in the meantime.
--
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/topup-exercise-muscles-name-drift.sql

BEGIN;

-- Coverage before (expect with_muscles = 67).
SELECT
  count(*)                         AS public_exercises,
  count(*) FILTER (WHERE mc.n > 0) AS with_muscles,
  count(*) FILTER (WHERE mc.n = 0) AS without_muscles
FROM (
  SELECT e.id, count(em.id) AS n
  FROM exercises e LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
  WHERE e.trainer_id IS NULL GROUP BY e.id
) mc;

INSERT INTO exercise_muscles (exercise_id, muscle, role)
SELECT e.id, v.muscle, v.role::muscle_role
FROM exercises e
JOIN (VALUES
  -- ── Stretching ──────────────────────────────────────────────────────────
  ('90-90 Hip Stretch', 'gluteus_maximus', 'primary'),
  ('90-90 Hip Stretch', 'gluteus_medius', 'primary'),
  ('90-90 Hip Stretch', 'hip_flexors', 'secondary'),
  ('Chest Opener Stretch', 'pectoralis_major', 'primary'),
  ('Chest Opener Stretch', 'deltoid_anterior', 'secondary'),
  ('Cobra Pose', 'rectus_abdominis', 'primary'),
  ('Cobra Pose', 'hip_flexors', 'secondary'),
  ('Cross-body Shoulder Stretch', 'deltoid_posterior', 'primary'),
  ('Cross-body Shoulder Stretch', 'trapezius_middle', 'secondary'),
  ('Doorframe Chest Stretch', 'pectoralis_major', 'primary'),
  ('Doorframe Chest Stretch', 'deltoid_anterior', 'secondary'),
  ('IT Band Stretch', 'hip_abductors', 'primary'),
  ('IT Band Stretch', 'gluteus_medius', 'secondary'),
  ('Overhead Tricep Stretch', 'triceps_brachii', 'primary'),
  ('Overhead Tricep Stretch', 'latissimus_dorsi', 'secondary'),
  ('Standing Calf Stretch', 'gastrocnemius', 'primary'),
  ('Standing Calf Stretch', 'soleus', 'primary'),
  ('Supine Hamstring Stretch', 'hamstrings', 'primary'),
  ('Supine Hamstring Stretch', 'gastrocnemius', 'secondary'),
  ('Supine Spinal Twist', 'obliques', 'primary'),
  ('Supine Spinal Twist', 'erector_spinae', 'primary'),
  ('Supine Spinal Twist', 'gluteus_maximus', 'secondary'),
  ('Thoracic Rotation Stretch', 'erector_spinae', 'primary'),
  ('Thoracic Rotation Stretch', 'obliques', 'secondary'),

  -- ── Calisthenics ────────────────────────────────────────────────────────
  ('Bicycle Crunch', 'rectus_abdominis', 'primary'),
  ('Bicycle Crunch', 'obliques', 'primary'),
  ('Bicycle Crunch', 'hip_flexors', 'secondary'),
  ('Bodyweight Squat', 'quadriceps', 'primary'),
  ('Bodyweight Squat', 'gluteus_maximus', 'primary'),
  ('Bodyweight Squat', 'hamstrings', 'secondary'),
  ('Chin-up', 'latissimus_dorsi', 'primary'),
  ('Chin-up', 'biceps_brachii', 'primary'),
  ('Chin-up', 'rhomboids', 'secondary'),
  ('Chin-up', 'teres_major', 'secondary'),
  ('Diamond Push-up', 'triceps_brachii', 'primary'),
  ('Diamond Push-up', 'pectoralis_major', 'primary'),
  ('Diamond Push-up', 'deltoid_anterior', 'secondary'),
  ('Glute Bridge', 'gluteus_maximus', 'primary'),
  ('Glute Bridge', 'hamstrings', 'secondary'),
  ('Glute Bridge', 'rectus_abdominis', 'secondary'),
  ('Handstand Push-up', 'deltoid_anterior', 'primary'),
  ('Handstand Push-up', 'triceps_brachii', 'primary'),
  ('Handstand Push-up', 'deltoid_lateral', 'secondary'),
  ('Handstand Push-up', 'trapezius_upper', 'secondary'),
  ('Inverted Row', 'latissimus_dorsi', 'primary'),
  ('Inverted Row', 'rhomboids', 'primary'),
  ('Inverted Row', 'trapezius_middle', 'secondary'),
  ('Inverted Row', 'biceps_brachii', 'secondary'),
  ('Jumping Jack', 'deltoid_lateral', 'primary'),
  ('Jumping Jack', 'hip_abductors', 'primary'),
  ('Jumping Jack', 'gastrocnemius', 'secondary'),
  ('Kettlebell Swing', 'gluteus_maximus', 'primary'),
  ('Kettlebell Swing', 'hamstrings', 'primary'),
  ('Kettlebell Swing', 'erector_spinae', 'secondary'),
  ('Kettlebell Swing', 'deltoid_anterior', 'secondary'),
  ('Mountain Climber', 'rectus_abdominis', 'primary'),
  ('Mountain Climber', 'hip_flexors', 'primary'),
  ('Mountain Climber', 'obliques', 'secondary'),
  ('Mountain Climber', 'deltoid_anterior', 'secondary'),
  ('Pike Push-up', 'deltoid_anterior', 'primary'),
  ('Pike Push-up', 'triceps_brachii', 'primary'),
  ('Pike Push-up', 'deltoid_lateral', 'secondary'),
  ('Pistol Squat', 'quadriceps', 'primary'),
  ('Pistol Squat', 'gluteus_maximus', 'primary'),
  ('Pistol Squat', 'hamstrings', 'secondary'),
  ('Pistol Squat', 'gluteus_medius', 'secondary'),
  ('Pull-up', 'latissimus_dorsi', 'primary'),
  ('Pull-up', 'biceps_brachii', 'secondary'),
  ('Pull-up', 'rhomboids', 'secondary'),
  ('Pull-up', 'teres_major', 'secondary'),
  ('Pull-up', 'trapezius_lower', 'secondary'),
  ('Push-up', 'pectoralis_major', 'primary'),
  ('Push-up', 'triceps_brachii', 'secondary'),
  ('Push-up', 'deltoid_anterior', 'secondary'),
  ('Push-up', 'rectus_abdominis', 'secondary'),
  ('Reverse Lunge', 'quadriceps', 'primary'),
  ('Reverse Lunge', 'gluteus_maximus', 'primary'),
  ('Reverse Lunge', 'hamstrings', 'secondary'),
  ('Reverse Lunge', 'gluteus_medius', 'secondary'),
  ('Tricep Dip', 'triceps_brachii', 'primary'),
  ('Tricep Dip', 'pectoralis_major', 'secondary'),
  ('Tricep Dip', 'deltoid_anterior', 'secondary'),
  ('Turkish Get-up', 'deltoid_anterior', 'primary'),
  ('Turkish Get-up', 'rectus_abdominis', 'primary'),
  ('Turkish Get-up', 'obliques', 'secondary'),
  ('Turkish Get-up', 'quadriceps', 'secondary'),
  ('Wall Sit', 'quadriceps', 'primary'),
  ('Wall Sit', 'gluteus_maximus', 'secondary'),
  ('Wide Push-up', 'pectoralis_major', 'primary'),
  ('Wide Push-up', 'deltoid_anterior', 'secondary'),
  ('Wide Push-up', 'triceps_brachii', 'secondary'),

  -- ── Resistance ──────────────────────────────────────────────────────────
  ('Ab Wheel Rollout', 'rectus_abdominis', 'primary'),
  ('Ab Wheel Rollout', 'transverse_abdominis', 'primary'),
  ('Ab Wheel Rollout', 'obliques', 'secondary'),
  ('Ab Wheel Rollout', 'latissimus_dorsi', 'secondary'),
  ('Barbell Lunge', 'quadriceps', 'primary'),
  ('Barbell Lunge', 'gluteus_maximus', 'primary'),
  ('Barbell Lunge', 'hamstrings', 'secondary'),
  ('Barbell Lunge', 'gluteus_medius', 'secondary'),
  ('Barbell Overhead Press', 'deltoid_anterior', 'primary'),
  ('Barbell Overhead Press', 'deltoid_lateral', 'secondary'),
  ('Barbell Overhead Press', 'triceps_brachii', 'secondary'),
  ('Barbell Overhead Press', 'trapezius_upper', 'secondary'),
  ('Cable Curl', 'biceps_brachii', 'primary'),
  ('Cable Curl', 'brachialis', 'secondary'),
  ('Cable Curl', 'forearm_flexors', 'secondary'),
  ('Cable Lateral Raise', 'deltoid_lateral', 'primary'),
  ('Cable Lateral Raise', 'deltoid_anterior', 'secondary'),
  ('Cable Lateral Raise', 'trapezius_upper', 'secondary'),
  ('Chest Dip', 'pectoralis_major', 'primary'),
  ('Chest Dip', 'triceps_brachii', 'secondary'),
  ('Chest Dip', 'deltoid_anterior', 'secondary'),
  ('Close-Grip Bench Press', 'triceps_brachii', 'primary'),
  ('Close-Grip Bench Press', 'pectoralis_major', 'primary'),
  ('Close-Grip Bench Press', 'deltoid_anterior', 'secondary'),
  ('Conventional Deadlift', 'erector_spinae', 'primary'),
  ('Conventional Deadlift', 'gluteus_maximus', 'primary'),
  ('Conventional Deadlift', 'hamstrings', 'primary'),
  ('Conventional Deadlift', 'quadriceps', 'secondary'),
  ('Conventional Deadlift', 'trapezius_upper', 'secondary'),
  ('Conventional Deadlift', 'latissimus_dorsi', 'secondary'),
  ('Conventional Deadlift', 'forearm_flexors', 'secondary'),
  ('Dumbbell Lunge', 'quadriceps', 'primary'),
  ('Dumbbell Lunge', 'gluteus_maximus', 'primary'),
  ('Dumbbell Lunge', 'hamstrings', 'secondary'),
  ('Dumbbell Lunge', 'gluteus_medius', 'secondary'),
  ('Front Squat', 'quadriceps', 'primary'),
  ('Front Squat', 'gluteus_maximus', 'secondary'),
  ('Front Squat', 'erector_spinae', 'secondary'),
  ('Front Squat', 'rectus_abdominis', 'secondary'),
  ('Hanging Leg Raise', 'rectus_abdominis', 'primary'),
  ('Hanging Leg Raise', 'hip_flexors', 'primary'),
  ('Hanging Leg Raise', 'obliques', 'secondary'),
  ('Hanging Leg Raise', 'forearm_flexors', 'secondary'),
  ('Hyperextension', 'erector_spinae', 'primary'),
  ('Hyperextension', 'gluteus_maximus', 'secondary'),
  ('Hyperextension', 'hamstrings', 'secondary'),
  ('Incline Dumbbell Curl', 'biceps_brachii', 'primary'),
  ('Incline Dumbbell Curl', 'brachialis', 'secondary'),
  ('Incline Dumbbell Press', 'pectoralis_major', 'primary'),
  ('Incline Dumbbell Press', 'deltoid_anterior', 'primary'),
  ('Incline Dumbbell Press', 'triceps_brachii', 'secondary'),
  ('Push Press', 'deltoid_anterior', 'primary'),
  ('Push Press', 'triceps_brachii', 'secondary'),
  ('Push Press', 'deltoid_lateral', 'secondary'),
  ('Push Press', 'quadriceps', 'secondary'),
  ('Push Press', 'trapezius_upper', 'secondary'),
  ('Rear Delt Flye', 'deltoid_posterior', 'primary'),
  ('Rear Delt Flye', 'rhomboids', 'secondary'),
  ('Rear Delt Flye', 'trapezius_middle', 'secondary'),
  ('Seated Cable Row', 'latissimus_dorsi', 'primary'),
  ('Seated Cable Row', 'rhomboids', 'primary'),
  ('Seated Cable Row', 'trapezius_middle', 'secondary'),
  ('Seated Cable Row', 'biceps_brachii', 'secondary'),
  ('Seated Cable Row', 'deltoid_posterior', 'secondary'),
  ('Standing Calf Raise', 'gastrocnemius', 'primary'),
  ('Standing Calf Raise', 'soleus', 'secondary'),
  ('Straight-Arm Pulldown', 'latissimus_dorsi', 'primary'),
  ('Straight-Arm Pulldown', 'teres_major', 'secondary'),
  ('Straight-Arm Pulldown', 'triceps_brachii', 'secondary'),
  ('Sumo Deadlift', 'gluteus_maximus', 'primary'),
  ('Sumo Deadlift', 'quadriceps', 'primary'),
  ('Sumo Deadlift', 'hamstrings', 'primary'),
  ('Sumo Deadlift', 'hip_adductors', 'secondary'),
  ('Sumo Deadlift', 'erector_spinae', 'secondary'),
  ('Sumo Deadlift', 'trapezius_upper', 'secondary'),
  ('Sumo Deadlift', 'forearm_flexors', 'secondary'),
  ('T-Bar Row', 'latissimus_dorsi', 'primary'),
  ('T-Bar Row', 'rhomboids', 'primary'),
  ('T-Bar Row', 'trapezius_middle', 'secondary'),
  ('T-Bar Row', 'biceps_brachii', 'secondary'),
  ('T-Bar Row', 'deltoid_posterior', 'secondary'),
  ('Tricep Kickback', 'triceps_brachii', 'primary'),
  ('Upright Row', 'deltoid_lateral', 'primary'),
  ('Upright Row', 'trapezius_upper', 'primary'),
  ('Upright Row', 'deltoid_anterior', 'secondary'),
  ('Upright Row', 'biceps_brachii', 'secondary'),
  ('Weighted Sit-up', 'rectus_abdominis', 'primary'),
  ('Weighted Sit-up', 'hip_flexors', 'secondary'),
  ('Weighted Sit-up', 'obliques', 'secondary'),

  -- ── Cooldown (foam rolling) ─────────────────────────────────────────────
  ('Foam Roll Calves', 'gastrocnemius', 'primary'),
  ('Foam Roll Calves', 'soleus', 'secondary'),
  ('Foam Roll IT Band', 'hip_abductors', 'primary'),
  ('Foam Roll IT Band', 'quadriceps', 'secondary'),
  ('Foam Roll Quads', 'quadriceps', 'primary'),
  ('Foam Roll Upper Back', 'trapezius_middle', 'primary'),
  ('Foam Roll Upper Back', 'rhomboids', 'primary'),
  ('Foam Roll Upper Back', 'erector_spinae', 'secondary')
) AS v(name, muscle, role) ON e.name = v.name AND e.trainer_id IS NULL
ON CONFLICT (exercise_id, muscle) DO NOTHING;

-- Coverage after (expect with_muscles = 125: 67 + 58).
SELECT
  count(*)                         AS public_exercises,
  count(*) FILTER (WHERE mc.n > 0) AS with_muscles,
  count(*) FILTER (WHERE mc.n = 0) AS without_muscles
FROM (
  SELECT e.id, count(em.id) AS n
  FROM exercises e LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
  WHERE e.trainer_id IS NULL GROUP BY e.id
) mc;

-- What remains without muscles (expect only cardio + Box Breathing + Slow
-- Treadmill Walk + Cable Crossover, i.e. intentional/handled-elsewhere).
SELECT e.name, e.workout_type
FROM exercises e LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
WHERE e.trainer_id IS NULL
GROUP BY e.name, e.workout_type
HAVING count(em.id) = 0
ORDER BY e.workout_type, e.name;

-- Change ROLLBACK -> COMMIT to apply.
ROLLBACK;
