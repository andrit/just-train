-- Analytics — Weekly retention cohorts
-- Read-only. Safe to run directly against prod. See docs/analytics-metrics.md.
--
-- Long form: one row per (cohort_week, week_number). Pivot to the triangle with
-- cohort_week down the side and week_number across the top; `pct` is the cell.
-- Cohort = signup week (date_trunc week of trainers.created_at, ISO Monday).
-- Retained in week N = the trainer's self-client logged a completed session in
-- the ISO week N weeks after signup. "Completed" = status='completed'.
--
-- Trainer-with-roster variant: drop `AND c.is_self = true` to count any client.

WITH excluded AS (
  -- Test/dev accounts (NOT role-based; owner is a real admin). Fill in emails.
  SELECT unnest(ARRAY[]::text[]) AS email
),
eligible AS (
  SELECT t.id AS trainer_id, t.created_at
  FROM trainers t
  WHERE t.deactivated_at IS NULL
    AND t.email NOT IN (SELECT email FROM excluded)
),
self_client AS (
  SELECT c.id AS client_id, c.trainer_id
  FROM clients c
  JOIN eligible e ON e.trainer_id = c.trainer_id
  WHERE c.is_self = true
),
cohort AS (
  SELECT trainer_id, date_trunc('week', created_at)::date AS cohort_week
  FROM eligible
),
cohort_size AS (
  SELECT cohort_week, count(*) AS cohort_size
  FROM cohort
  GROUP BY cohort_week
),
activity AS (
  SELECT DISTINCT sc.trainer_id,
         date_trunc('week', s.date::date)::date AS active_week
  FROM self_client sc
  JOIN sessions s ON s.client_id = sc.client_id
  WHERE s.status = 'completed'
),
cohort_activity AS (
  SELECT co.cohort_week,
         co.trainer_id,
         ((a.active_week - co.cohort_week) / 7) AS week_number   -- both Monday-aligned → exact weeks
  FROM cohort co
  JOIN activity a ON a.trainer_id = co.trainer_id
  WHERE a.active_week >= co.cohort_week
)
SELECT
  ca.cohort_week,
  cs.cohort_size,
  ca.week_number,
  count(DISTINCT ca.trainer_id)                                   AS retained,
  round(100.0 * count(DISTINCT ca.trainer_id) / cs.cohort_size, 0) AS pct
FROM cohort_activity ca
JOIN cohort_size cs USING (cohort_week)
WHERE ca.week_number BETWEEN 0 AND 8
GROUP BY ca.cohort_week, cs.cohort_size, ca.week_number
ORDER BY ca.cohort_week DESC, ca.week_number;
