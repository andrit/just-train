-- Analytics — North Star: Weekly Logged Sessions (+ decomposition)
-- Read-only. Safe to run directly against prod. See docs/analytics-metrics.md.
--
-- Weekly Logged Sessions = Weekly Active Athletes × Sessions per Active Athlete.
-- Unit = athlete (a trainer's self-client, clients.is_self = true). "Completed"
-- = sessions.status = 'completed' (matches routes/kpis.ts + report.service.ts).
-- Week = ISO Monday, bucketed by the TRAINING date (sessions.date), not log time.
--
-- Trainer-with-roster variant: drop the `AND c.is_self = true` filter below to
-- count sessions for ANY client, not just the trainer's own training.

WITH excluded AS (
  -- Test / dev accounts to keep OUT of product metrics. Fill in real values.
  -- NOTE: the owner (ritterandrew1@gmail.com) is role='admin' but is a REAL user
  -- — do NOT exclude by role. List test accounts explicitly here.
  SELECT unnest(ARRAY[]::text[]) AS email
),
eligible AS (
  SELECT t.id AS trainer_id
  FROM trainers t
  WHERE t.deactivated_at IS NULL
    AND t.email NOT IN (SELECT email FROM excluded)
),
self_sessions AS (
  SELECT s.trainer_id,
         date_trunc('week', s.date::date)::date AS week
  FROM sessions s
  JOIN clients  c ON c.id = s.client_id AND c.is_self = true
  JOIN eligible e ON e.trainer_id = s.trainer_id
  WHERE s.status = 'completed'
)
SELECT
  week,
  count(*)                                                       AS logged_sessions,         -- ★ North Star
  count(DISTINCT trainer_id)                                     AS weekly_active_athletes,  -- breadth
  round(count(*)::numeric / nullif(count(DISTINCT trainer_id), 0), 2) AS sessions_per_athlete -- depth
FROM self_sessions
GROUP BY week
ORDER BY week DESC
LIMIT 26;  -- last ~6 months
