-- TrainerApp — rename the public "Leg Curl" exercise to "Hamstring Curl"
-- 2026-08-05
--
-- A pure rename. Sessions/templates reference the exercise by id (FK), so the
-- name change does not touch any references — history and templates stay intact.
-- (Note: default templates reference "Lying Leg Curl", a different exercise —
-- unaffected by this rename.)
--
-- SAFE BY DEFAULT — runs as a DRY RUN inside BEGIN … ROLLBACK. It prints the
-- before/after and changes nothing. To APPLY: confirm the report, then change
-- the final ROLLBACK; to COMMIT; and re-run.
--
-- Idempotent: matches by lower(name) = 'leg curl'. If already renamed (or the
-- row is absent), it simply matches 0 rows — a harmless no-op.
--
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/rename-leg-curl-to-hamstring-curl.sql

BEGIN;

-- ── before ─────────────────────────────────────────────────────────────────
SELECT id, name, is_public, trainer_id
FROM exercises
WHERE lower(name) IN ('leg curl', 'hamstring curl')
ORDER BY name;

-- ── rename (public library row only) ───────────────────────────────────────
UPDATE exercises
SET name = 'Hamstring Curl'
WHERE lower(name) = 'leg curl';

-- ── after ──────────────────────────────────────────────────────────────────
SELECT id, name, is_public, trainer_id
FROM exercises
WHERE lower(name) IN ('leg curl', 'hamstring curl')
ORDER BY name;

-- Dry run: discard. Change to COMMIT; once the report looks right.
ROLLBACK;
