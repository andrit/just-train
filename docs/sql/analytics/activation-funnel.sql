-- Analytics — Activation funnel (signup → habit)
-- Read-only. Safe to run directly against prod. See docs/analytics-metrics.md.
--
-- Returns one row of stage counts; compute step conversions by hand (each stage
-- ÷ the one above). Unit = athlete (self-client). "Completed" = status='completed'.
-- Activation window = 7 days from signup; habit = ≥3 completed in 14 days.
-- "Landing visit" (top of funnel) is NOT here — it lives on the marketing site.

WITH excluded AS (
  -- Test/dev accounts (NOT role-based; owner is a real admin). Fill in emails.
  SELECT unnest(ARRAY[]::text[]) AS email
),
eligible AS (
  SELECT t.id AS trainer_id, t.created_at, t.onboarded_at
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
first_start AS (                 -- reached "started a session"
  SELECT sc.trainer_id
  FROM self_client sc
  JOIN sessions s ON s.client_id = sc.client_id
  WHERE s.start_time IS NOT NULL
  GROUP BY sc.trainer_id
),
first_complete AS (             -- first completed session (by training date)
  SELECT sc.trainer_id, min(s.date::date) AS first_complete_date
  FROM self_client sc
  JOIN sessions s ON s.client_id = sc.client_id
  WHERE s.status = 'completed'
  GROUP BY sc.trainer_id
),
completes_14d AS (              -- completed-session count within 14 days of signup
  SELECT sc.trainer_id, count(*) AS n
  FROM self_client sc
  JOIN sessions s ON s.client_id = sc.client_id
  JOIN eligible e ON e.trainer_id = sc.trainer_id
  WHERE s.status = 'completed'
    AND s.date::date <= (e.created_at::date + INTERVAL '14 days')
  GROUP BY sc.trainer_id
)
SELECT
  (SELECT count(*) FROM eligible)                                              AS signed_up,
  (SELECT count(*) FROM eligible WHERE onboarded_at IS NOT NULL)               AS onboarded,
  (SELECT count(*) FROM first_start)                                           AS started_first_session,
  (SELECT count(*)
     FROM eligible e
     JOIN first_complete fc ON fc.trainer_id = e.trainer_id
    WHERE fc.first_complete_date <= (e.created_at::date + INTERVAL '7 days'))  AS activated_7d,
  (SELECT count(*) FROM completes_14d WHERE n >= 3)                            AS habit_3x_14d;
