-- body-heat-distribution.sql
-- READ-ONLY. Tunes the tier thresholds for task-plan-body-heat-absolute-5tier.
-- Mirrors the /clients/:id/muscle-frequency join: distinct COMPLETED sessions
-- per muscle in the last 30 days. (sessions.date is a 'YYYY-MM-DD' string column.)
-- Safe to run directly against prod — no writes, no transaction wrapper needed.

WITH per_muscle AS (
  SELECT s.client_id,
         em.muscle,
         COUNT(DISTINCT s.id) AS sessions_30d
  FROM sessions s
  JOIN session_exercises se ON se.session_id = s.id
  JOIN exercise_muscles  em ON em.exercise_id = se.exercise_id
  WHERE s.status = 'completed'
    AND s.date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
  GROUP BY s.client_id, em.muscle
)
-- 1) Histogram: how many (client, muscle) pairs sit at each session-count.
SELECT sessions_30d,
       COUNT(*) AS client_muscle_pairs
FROM per_muscle
GROUP BY sessions_30d
ORDER BY sessions_30d;

-- 2) Percentile summary (run separately if your client supports it):
-- SELECT percentile_cont(ARRAY[0.5, 0.75, 0.9, 0.99]) WITHIN GROUP (ORDER BY sessions_30d)
-- FROM per_muscle;
