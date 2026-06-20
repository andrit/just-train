# Database Management

Common SQL operations and maintenance notes for TrainerApp.
Use queries in Railway's query console, psql, or TablePlus.

## Maintenance

### Schema changes — always generate a migration before deploying

Whenever a column, table, or enum is added to a schema file, run this immediately
before deploying — skipping it is what causes schema drift between the Drizzle
snapshot and the production database (e.g. the missing `type` column on `templates`).

```bash
cd apps/backend && npx drizzle-kit generate
```

To verify the live database is in sync with the schema:

```bash
cd apps/backend && npx drizzle-kit check
```

### Backup before any destructive operation

Run this before any DELETE, DROP, or ALTER on production. Faster to restore from
than Railway's point-in-time recovery and doesn't require a support ticket.

```bash
pg_dump -h interchange.proxy.rlwy.net -U postgres -p 24145 -d railway -F c -f backup-$(date +%Y%m%d).dump
```

Restore from dump if needed:
```bash
pg_restore -h interchange.proxy.rlwy.net -U postgres -p 24145 -d railway -F c backup-<date>.dump
```

### Adding a value to an existing enum

Drizzle doesn't handle enum value additions cleanly. Do it directly in SQL — no
migration file needed, but note it in the Hotfixes section below.

```sql
-- Example: adding 'coach' to the trainer_role enum
ALTER TYPE trainer_role ADD VALUE 'coach';
```

Note: enum values can be added but not removed without dropping and recreating the
type. Think carefully before adding — you can't roll it back easily.

### Adding indexes on production (always use CONCURRENTLY)

Without `CONCURRENTLY`, Postgres locks the table for reads and writes until the index
builds — dangerous on a live database. Always use the flag on production.

```sql
-- Safe on production — no table lock
CREATE INDEX CONCURRENTLY idx_sessions_client_date
  ON sessions (client_id, date DESC);

-- Check existing indexes on a table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sessions';
```

### Check for long-running or hung queries

Useful when the app feels slow or a Railway console query seems stuck.

```sql
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - INTERVAL '30 seconds'
ORDER BY duration DESC;
```

To cancel a specific query without killing the connection:
```sql
SELECT pg_cancel_backend(<pid>);
```

To forcibly terminate a connection:
```sql
SELECT pg_terminate_backend(<pid>);
```

### Browse schema and data with Drizzle Studio

Opens a local browser UI to inspect tables, columns, and rows without writing SQL.
Useful for quick lookups and schema browsing.

```bash
cd apps/backend && npx drizzle-kit studio
```

Then open `https://local.drizzle.studio` in your browser. Read-only by default —
edits are possible but be careful when pointed at production credentials.

## Connecting via psql

```bash
# Production (Railway) — use the PUBLIC network URL, not the internal one.
# Internal URL (postgres.railway.internal) only works between Railway services.
# Password is in Railway → Postgres service → Variables → POSTGRES_PASSWORD
psql -h interchange.proxy.rlwy.net -U postgres -p 24145 -d railway
# psql will prompt for the password, or prefix with: PGPASSWORD=<your-password>

# Local
psql postgresql://localhost:5432/trainer_app
```

All tables use UUID primary keys generated with `gen_random_uuid()`.
Timestamps use `NOW()` for the current time in UTC.

---

## User Accounts

### List all trainer accounts
```sql
SELECT
  id,
  name,
  email,
  role,
  trainer_mode,
  subscription_tier,
  subscription_status,
  email_verified,
  last_login_at,
  created_at
FROM trainers
ORDER BY created_at DESC;
```

### Look up a trainer by email
```sql
SELECT
  id,
  name,
  email,
  role,
  trainer_mode,
  subscription_tier,
  subscription_status,
  email_verified,
  onboarded_at,
  last_login_at,
  last_active_at,
  created_at
FROM trainers
WHERE email = 'user@example.com';
```

### Full trainer profile (all fields)
```sql
SELECT * FROM trainers WHERE email = 'user@example.com';
```

### Check active refresh tokens for a trainer (logged-in devices)
```sql
SELECT
  rt.id,
  rt.device_name,
  rt.device_id,
  rt.expires_at,
  rt.last_used_at,
  rt.revoked_at,
  rt.created_at
FROM refresh_tokens rt
JOIN trainers t ON t.id = rt.trainer_id
WHERE t.email = 'user@example.com'
  AND rt.revoked_at IS NULL
  AND rt.expires_at > NOW()
ORDER BY rt.last_used_at DESC;
```

### Revoke all sessions for a trainer (force logout everywhere)
```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE trainer_id = (SELECT id FROM trainers WHERE email = 'user@example.com')
  AND revoked_at IS NULL;
```

### Verify trainer's email manually
```sql
UPDATE trainers
SET email_verified = true, updated_at = NOW()
WHERE email = 'user@example.com';
```

### Change a trainer's subscription tier
```sql
-- subscription_tier:   free | pro | studio
-- subscription_status: trialing | active | past_due | canceled | paused
UPDATE trainers
SET subscription_tier = 'pro',
    subscription_status = 'active',
    updated_at = NOW()
WHERE email = 'user@example.com';
```

### See subscription status across all accounts
```sql
SELECT
  subscription_tier,
  subscription_status,
  trainer_mode,
  COUNT(*) AS count
FROM trainers
GROUP BY subscription_tier, subscription_status, trainer_mode
ORDER BY subscription_tier, subscription_status;
```

### Accounts that have never onboarded
```sql
SELECT id, name, email, created_at
FROM trainers
WHERE onboarded_at IS NULL
ORDER BY created_at DESC;
```

### Update a trainer's name
```sql
UPDATE trainers
SET name = 'New Name', updated_at = NOW()
WHERE email = 'user@example.com';
```

### Delete a trainer account (irreversible — cascades everything)
```sql
-- Cascades: clients → sessions → workouts → sets, exercises, templates,
--           refresh_tokens, challenges, client_goals, client_snapshots,
--           trainer_usage_monthly
-- Confirm the account first before running the delete.
DELETE FROM trainers WHERE email = 'user@example.com';
```

### Accounts with no activity in 30+ days
```sql
SELECT id, name, email, last_active_at, last_login_at
FROM trainers
WHERE last_active_at < NOW() - INTERVAL '30 days'
   OR last_active_at IS NULL
ORDER BY last_active_at NULLS FIRST;
```

---

## Finding IDs

### Get all trainers (quick reference)
```sql
SELECT id, name, email, trainer_mode, created_at FROM trainers ORDER BY created_at;
```

### Get all clients for a trainer
```sql
SELECT
  id, name, email, active, is_self,
  progression_state, primary_focus,
  weekly_session_target, last_active_at
FROM clients
WHERE trainer_id = '<trainer_id>'
ORDER BY name;
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
  active, is_self,
  progression_state,
  primary_focus,
  weekly_session_target,
  created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  '<trainer_id>',
  'Client Name',
  'client@example.com',
  NULL,
  true,
  false,             -- is_self: true only for the trainer's self-training client
  'assessment',      -- progression_state: assessment | programming | maintenance
  'strength',        -- primary_focus: strength | hypertrophy | weight_loss | endurance | mobility | general_fitness | sport_specific — or NULL
  3,                 -- weekly_session_target for consistency score
  NOW(), NOW()
);
```

### Deactivate a client
```sql
UPDATE clients SET active = false, updated_at = NOW()
WHERE id = '<client_id>' AND trainer_id = '<trainer_id>';
```

### Advance a client's progression state
```sql
-- progression_state: assessment | programming | maintenance
UPDATE clients
SET progression_state = 'programming', updated_at = NOW()
WHERE id = '<client_id>';
```

---

## Client Goals

### List all active goals for a client
```sql
SELECT id, goal, progression_state, set_at, achieved_at
FROM client_goals
WHERE client_id = '<client_id>'
ORDER BY set_at DESC;
```

### Add a goal for a client
```sql
INSERT INTO client_goals (id, client_id, goal, progression_state, set_at, created_at)
VALUES (
  gen_random_uuid(),
  '<client_id>',
  'Run a 5K without stopping by end of the month.',
  'programming',   -- progression_state at time of goal
  NOW(),
  NOW()
);
```

### Mark a goal as achieved
```sql
UPDATE client_goals
SET achieved_at = NOW()
WHERE id = '<goal_id>';
```

---

## Client Snapshots

### List all snapshots for a client
```sql
SELECT
  id,
  captured_at,
  progression_state,
  weight_lbs,
  body_fat_pct,
  energy_level,
  sleep_quality,
  stress_level,
  self_image_score,
  trainer_notes
FROM client_snapshots
WHERE client_id = '<client_id>'
ORDER BY captured_at DESC;
```

### Compare first vs most recent snapshot (then vs now)
```sql
WITH ordered AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY captured_at ASC)  AS rn_first,
    ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY captured_at DESC) AS rn_last
  FROM client_snapshots
  WHERE client_id = '<client_id>'
)
SELECT
  'first'        AS snapshot,
  captured_at,
  weight_lbs,
  body_fat_pct,
  energy_level,
  self_image_score
FROM ordered WHERE rn_first = 1
UNION ALL
SELECT
  'latest'       AS snapshot,
  captured_at,
  weight_lbs,
  body_fat_pct,
  energy_level,
  self_image_score
FROM ordered WHERE rn_last = 1;
```

### Add a snapshot manually
```sql
INSERT INTO client_snapshots (
  id, client_id, captured_by, captured_at,
  progression_state,
  weight_lbs, body_fat_pct,
  energy_level, sleep_quality, stress_level, mobility_feel, self_image_score,
  trainer_notes,
  created_at
)
VALUES (
  gen_random_uuid(),
  '<client_id>',
  '<trainer_id>',
  NOW(),
  'programming',
  185.5,   -- weight_lbs (NULL if not measured)
  NULL,    -- body_fat_pct
  7,       -- energy_level 1–10
  6,       -- sleep_quality 1–10
  4,       -- stress_level 1–10
  7,       -- mobility_feel 1–10
  6,       -- self_image_score 1–10
  NULL,    -- trainer_notes
  NOW()
);
```

---

## Challenges

### List all active challenges for a client
```sql
SELECT
  c.id,
  c.title,
  c.metric_type,
  e.name AS exercise,
  c.current_value,
  c.target_value,
  c.target_unit,
  c.deadline,
  c.status
FROM challenges c
LEFT JOIN exercises e ON e.id = c.exercise_id
WHERE c.client_id = '<client_id>'
  AND c.status = 'active'
ORDER BY c.deadline ASC;
```

### All challenges for a trainer across all clients
```sql
SELECT
  cl.name AS client,
  ch.title,
  ch.metric_type,
  ch.current_value,
  ch.target_value,
  ch.target_unit,
  ch.deadline,
  ch.status
FROM challenges ch
JOIN clients cl ON cl.id = ch.client_id
WHERE ch.trainer_id = '<trainer_id>'
ORDER BY ch.deadline ASC;
```

### Manually update challenge progress
```sql
UPDATE challenges
SET current_value = 7, updated_at = NOW()
WHERE id = '<challenge_id>';
```

### Mark a challenge complete
```sql
UPDATE challenges
SET status = 'completed', completed_at = NOW(), updated_at = NOW()
WHERE id = '<challenge_id>';
```

### Expire a past-deadline challenge
```sql
UPDATE challenges
SET status = 'expired', updated_at = NOW()
WHERE id = '<challenge_id>'
  AND status = 'active'
  AND deadline < CURRENT_DATE;
```

---

## Trainer Preferences

### Reset PR notify preference
```sql
-- pr_notify_type: '1rm' | 'volume' | 'both'
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

### Change product mode
```sql
-- trainer_mode: 'trainer' | 'athlete'
UPDATE trainers
SET trainer_mode = 'athlete', updated_at = NOW()
WHERE id = '<trainer_id>';
```

### Enable / disable at-risk alerts
```sql
UPDATE trainers
SET alerts_enabled = false, updated_at = NOW()
WHERE id = '<trainer_id>';
```

### Change photo sharing preference
```sql
-- 'private' | 'share_selected' | 'share_all'
UPDATE trainers
SET photo_sharing_preference = 'share_selected', updated_at = NOW()
WHERE id = '<trainer_id>';
```

### Update timezone
```sql
-- IANA timezone string e.g. 'America/New_York', 'Europe/London'
UPDATE trainers
SET timezone = 'America/New_York', updated_at = NOW()
WHERE id = '<trainer_id>';
```

---

## Sessions

### List recent sessions for a client
```sql
SELECT s.id, s.date, s.status, s.name, s.start_time, s.end_time,
       s.energy_level, s.mobility_feel, s.stress_level
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

## Personal Bests

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

## Usage & Billing

### Monthly usage rollup for a trainer
```sql
SELECT
  period_year,
  period_month,
  active_client_count,
  sessions_completed,
  total_sets_logged,
  snapshots_taken,
  reports_generated,
  goals_actioned,
  total_client_count,
  calculated_at
FROM trainer_usage_monthly
WHERE trainer_id = '<trainer_id>'
ORDER BY period_year DESC, period_month DESC;
```

### Usage summary across all trainers this month
```sql
SELECT
  t.name,
  t.email,
  t.subscription_tier,
  u.active_client_count,
  u.sessions_completed,
  u.reports_generated
FROM trainer_usage_monthly u
JOIN trainers t ON t.id = u.trainer_id
WHERE u.period_year  = EXTRACT(YEAR  FROM NOW())
  AND u.period_month = EXTRACT(MONTH FROM NOW())
ORDER BY u.active_client_count DESC;
```

---

## Useful Inspection Queries

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

## Migrations

Planned schema changes applied in order across all environments. When a new column,
table, or type is added to the Drizzle schema, the corresponding migration goes here
and must be applied to every environment (local, staging, prod).

After applying a migration manually, create the proper Drizzle migration file so the
journal stays in sync: `cd apps/backend && npx drizzle-kit generate`.

---

### 001 — Add `type` column to `templates` (2026-06-20)

The `template_type` enum and `type` column were added to the Drizzle schema but not
applied to production. All existing templates default to `'session'`.

```sql
CREATE TYPE template_type AS ENUM ('session', 'workout');

ALTER TABLE templates
  ADD COLUMN type template_type NOT NULL DEFAULT 'session';
```

---

## Hotfixes

One-off SQL run directly on production outside the normal deploy cycle — reactive
fixes for broken data or emergencies. Log every hotfix here with a date and reason.
If a hotfix changes the schema it should also become a Migration entry above.

---

### 2026-06-20 — Duplicate exercise names

Duplicate exercises were created with typos. Check which duplicate has session data
before deleting.

```sql
-- Find duplicates and see which has logged data
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

-- Delete the typo/duplicate with no session data (confirm ID first)
DELETE FROM exercises WHERE id = '<id-of-empty-duplicate>';

-- Rename Dumbbell Fly → Dumbbell Flye (if old name still exists)
UPDATE exercises SET name = 'Dumbbell Flye' WHERE name = 'Dumbbell Fly';
```
