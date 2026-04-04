# SQL Commands

Common SQL operations for managing TrainerApp data directly in the database.
Use these in Railway's query console, psql, or TablePlus.

All tables use UUID primary keys generated with `gen_random_uuid()`.
Timestamps use `NOW()` for the current time in UTC.

---

## Finding IDs

### Get all trainers
```sql
SELECT id, name, email, created_at FROM trainers ORDER BY created_at;
```

### Get all clients for a trainer
```sql
SELECT id, name, email, active FROM clients WHERE trainer_id = '<trainer_id>' ORDER BY name;
```

### Get an exercise ID by name
```sql
-- Exercises are per-trainer
SELECT id, name, workout_type FROM exercises
WHERE trainer_id = '<trainer_id>' AND name = 'Barbell Back Squat';
```

### Get all exercises for a trainer
```sql
SELECT id, name, workout_type, body_part_id, equipment, difficulty
FROM exercises
WHERE trainer_id = '<trainer_id>'
ORDER BY workout_type, name;
```

### Get all templates for a trainer
```sql
SELECT id, name, description, created_at FROM templates
WHERE trainer_id = '<trainer_id>'
ORDER BY name;
```

---

## Templates

### Add a new template
```sql
-- Step 1: Create the template
INSERT INTO templates (id, trainer_id, name, description, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '<trainer_id>',
  'Template Name',
  'Optional description.',
  NOW(), NOW()
)
RETURNING id;  -- copy this id for the next step
```

### Add a workout block to a template
```sql
-- workout_type: resistance | cardio | calisthenics | stretching | cooldown
INSERT INTO template_workouts (id, template_id, workout_type, order_index, notes)
VALUES (
  gen_random_uuid(),
  '<template_id>',
  'resistance',
  0,           -- order_index: 0, 1, 2... controls display order
  NULL
)
RETURNING id;  -- copy this id for the next step
```

### Add an exercise to a template block
```sql
INSERT INTO template_exercises (
  id, template_workout_id, exercise_id,
  order_index,
  target_sets, target_reps, target_weight, target_weight_unit,
  target_duration_seconds, target_distance, target_intensity,
  notes
)
VALUES (
  gen_random_uuid(),
  '<template_workout_id>',
  (SELECT id FROM exercises WHERE name = 'Barbell Back Squat' AND trainer_id = '<trainer_id>'),
  0,           -- order_index within the block
  3,           -- target_sets (NULL if not applicable)
  10,          -- target_reps (NULL for cardio/stretching)
  60,          -- target_weight in lbs (NULL if bodyweight or cardio)
  'lbs',       -- target_weight_unit: lbs | kg
  NULL,        -- target_duration_seconds (for stretching/cardio/calisthenics)
  NULL,        -- target_distance (for cardio)
  NULL,        -- target_intensity: light | moderate | vigorous | max (for cardio)
  NULL         -- notes
);
```

### Full template insert — one script
Paste this pattern to add a complete template with blocks in one go:
```sql
DO $$
DECLARE
  tmpl_id   UUID := gen_random_uuid();
  block1_id UUID := gen_random_uuid();
  tid       UUID := '<trainer_id>';  -- ← replace with real trainer_id
BEGIN
  INSERT INTO templates (id, trainer_id, name, description, created_at, updated_at)
  VALUES (tmpl_id, tid, 'Beginner Push Day', 'Chest, shoulders, triceps for beginners.', NOW(), NOW());

  INSERT INTO template_workouts (id, template_id, workout_type, order_index)
  VALUES (block1_id, tmpl_id, 'resistance', 0);

  INSERT INTO template_exercises (id, template_workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, target_weight_unit)
  VALUES
    (gen_random_uuid(), block1_id, (SELECT id FROM exercises WHERE name = 'Dumbbell Bench Press' AND trainer_id = tid), 0, 3, 12, 20, 'lbs'),
    (gen_random_uuid(), block1_id, (SELECT id FROM exercises WHERE name = 'Dumbbell Shoulder Press' AND trainer_id = tid), 1, 3, 12, 15, 'lbs'),
    (gen_random_uuid(), block1_id, (SELECT id FROM exercises WHERE name = 'Lateral Raise' AND trainer_id = tid), 2, 3, 15, 8, 'lbs'),
    (gen_random_uuid(), block1_id, (SELECT id FROM exercises WHERE name = 'Tricep Pushdown' AND trainer_id = tid), 3, 3, 15, 15, 'lbs');
END $$;
```

### Delete a template (cascades to blocks and exercises)
```sql
DELETE FROM templates WHERE id = '<template_id>' AND trainer_id = '<trainer_id>';
```

### Rename a template
```sql
UPDATE templates
SET name = 'New Name', description = 'New description.', updated_at = NOW()
WHERE id = '<template_id>';
```

---

## Exercises

### Add a new exercise
```sql
INSERT INTO exercises (
  id, trainer_id, name, workout_type, body_part_id,
  equipment, difficulty, category,
  description, instructions,
  is_draft, is_public,
  created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  '<trainer_id>',
  'Exercise Name',
  'resistance',    -- workout_type: resistance | cardio | calisthenics | stretching | cooldown
  (SELECT id FROM body_parts WHERE name = 'chest'),
  'barbell',       -- equipment: barbell | dumbbell | cable | machine | kettlebell | resistance_band | cardio_machine | bodyweight | none | other
  'beginner',      -- difficulty: beginner | intermediate | advanced
  'compound',      -- category: compound | isolation (resistance only, else NULL)
  'Description of the exercise.',
  'Step-by-step instructions.',
  false,           -- is_draft
  false,           -- is_public
  NOW(), NOW()
);
```

### Soft-delete an exercise (mark as draft)
```sql
UPDATE exercises SET is_draft = true, updated_at = NOW()
WHERE id = '<exercise_id>' AND trainer_id = '<trainer_id>';
```

---

## Clients

### Add a client manually
```sql
INSERT INTO clients (
  id, trainer_id, name, email, phone,
  active, is_self, weekly_session_target,
  created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  '<trainer_id>',
  'Client Name',
  'client@example.com',
  NULL,
  true,
  false,
  3,       -- weekly_session_target for consistency score
  NOW(), NOW()
);
```

### Deactivate a client
```sql
UPDATE clients SET active = false, updated_at = NOW()
WHERE id = '<client_id>' AND trainer_id = '<trainer_id>';
```

---

## Trainer preferences

### Reset a trainer's PR notify preference
```sql
UPDATE trainers
SET pr_notify_type = '1rm', updated_at = NOW()
WHERE id = '<trainer_id>';
```

### Change rest timer duration
```sql
-- Options: 30 | 60 | 90
UPDATE trainers
SET rest_duration_seconds = 60, updated_at = NOW()
WHERE id = '<trainer_id>';
```

---

## Sessions

### List recent sessions for a client
```sql
SELECT s.id, s.date, s.status, s.name, s.start_time, s.end_time
FROM sessions s
WHERE s.client_id = '<client_id>'
ORDER BY s.date DESC
LIMIT 20;
```

### Mark a stuck in-progress session as completed
```sql
UPDATE sessions
SET status = 'completed', end_time = NOW(), updated_at = NOW()
WHERE id = '<session_id>'
  AND status = 'in_progress';
```

### Delete a session and all its data (irreversible)
```sql
-- Cascades: workouts → session_exercises → sets
DELETE FROM sessions WHERE id = '<session_id>';
```

---

## Personal bests

### View all PRs for a client
```sql
SELECT
  e.name AS exercise,
  s.weight,
  s.reps,
  ROUND((s.weight * (1 + s.reps / 30.0))::numeric, 1) AS epley_1rm,
  s.weight * s.reps AS volume,
  sess.date
FROM sets s
JOIN session_exercises se ON s.session_exercise_id = se.id
JOIN workouts w ON se.workout_id = w.id
JOIN sessions sess ON w.session_id = sess.id
JOIN exercises e ON se.exercise_id = e.id
WHERE sess.client_id = '<client_id>'
  AND (s.is_pr = true OR s.is_pr_volume = true)
ORDER BY sess.date DESC;
```

### Backfill is_pr for existing sets (run once if needed)
```sql
-- Marks the highest Epley 1RM per client+exercise as a PR
-- Safe to re-run — only updates, does not delete data
WITH ranked AS (
  SELECT
    s.id,
    s.weight * (1 + s.reps / 30.0) AS epley,
    ROW_NUMBER() OVER (
      PARTITION BY sess.client_id, se.exercise_id
      ORDER BY s.weight * (1 + s.reps / 30.0) DESC
    ) AS rn
  FROM sets s
  JOIN session_exercises se ON s.session_exercise_id = se.id
  JOIN workouts w ON se.workout_id = w.id
  JOIN sessions sess ON w.session_id = sess.id
  WHERE s.weight IS NOT NULL AND s.reps IS NOT NULL AND s.reps > 0
)
UPDATE sets SET is_pr = true
WHERE id IN (SELECT id FROM ranked WHERE rn = 1);
```

---

## Useful inspection queries

### Count sessions per client this month
```sql
SELECT c.name, COUNT(s.id) AS sessions_this_month
FROM clients c
LEFT JOIN sessions s ON s.client_id = c.id
  AND s.date >= DATE_TRUNC('month', NOW())
  AND s.status = 'completed'
WHERE c.trainer_id = '<trainer_id>'
GROUP BY c.name
ORDER BY sessions_this_month DESC;
```

### Find clients with no session in 14+ days (at-risk)
```sql
SELECT c.name, c.email, MAX(s.date) AS last_session
FROM clients c
LEFT JOIN sessions s ON s.client_id = c.id AND s.status = 'completed'
WHERE c.trainer_id = '<trainer_id>' AND c.active = true
GROUP BY c.name, c.email
HAVING MAX(s.date) < NOW() - INTERVAL '14 days' OR MAX(s.date) IS NULL
ORDER BY last_session NULLS FIRST;
```

### Check template exercise coverage (find exercises missing from library)
```sql
-- Useful when template seeds reference an exercise that doesn't exist
SELECT DISTINCT te_name
FROM (
  SELECT 'Barbell Back Squat' AS te_name  -- replace with exercise name to check
) names
WHERE te_name NOT IN (
  SELECT name FROM exercises WHERE trainer_id = '<trainer_id>'
);
```

---

## Exercise Data Fixes (hotfix — run on production DB)

Before running deletes, check which duplicate has session data:
```sql
SELECT e.name, e.id, COUNT(se.id) as sets_logged
FROM exercises e
LEFT JOIN session_exercises se ON se.exercise_id = e.id
WHERE e.name IN (
  'Decline BArbell Bench Press',
  'Decline Barbell Bench Press',
  'Dumbbell Bench Press',
  'Pec Deck',
  'Dumbbell Fly',
  'Dumbbell Flye'
)
GROUP BY e.name, e.id
ORDER BY e.name;
```

Then delete the duplicate without data (keep whichever has sets_logged > 0):
```sql
-- Delete the typo/duplicate with no session data (confirm ID first)
DELETE FROM exercises WHERE id = '<id-of-empty-duplicate>';

-- Rename Dumbbell Fly → Dumbbell Flye (if old name still exists)
UPDATE exercises SET name = 'Dumbbell Flye' WHERE name = 'Dumbbell Fly';
```
