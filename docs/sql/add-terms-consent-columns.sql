-- TrainerApp — consent audit (account plan D3): record terms acceptance at register
-- 2026-11-13
--
-- Additive, non-destructive. Two nullable columns on `trainers`:
--   terms_accepted_at  — timestamp the user accepted the Terms / Privacy Policy.
--   terms_version      — the version string consented to (see TERMS_VERSION in
--                        packages/shared/src/schemas/index.ts).
-- New registrations stamp both in the register handler. Existing rows stay NULL
-- until backfilled (step 2 below).
--
-- ASSUMPTIONS (change in one place if wrong):
--   • TERMS_VERSION / go-live date = '2026-06-21' (the day /terms + /privacy went live).
--   • Backfill uses created_at as the acceptance timestamp proxy — defensible because
--     the register screen has shown passive consent ("by creating an account you agree…")
--     since that date. Accounts created BEFORE the terms existed get no consent record
--     (left NULL) — there is nothing to attest for them.
--
-- LOCAL dev: `cd apps/backend && pnpm db:push` (or drizzle-kit generate + migrate).
-- PROD (Railway): get the URL from Railway -> Postgres -> Variables -> DATABASE_PUBLIC_URL
-- (do NOT save it to a file), then:
--   psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-terms-consent-columns.sql

-- ── 1. Schema (idempotent, additive — safe to apply directly) ────────────────────
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "terms_version" text;

-- Verify columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trainers'
  AND column_name IN ('terms_accepted_at', 'terms_version')
ORDER BY column_name;

-- ── 2. Backfill existing accounts (data-mutating — DRY RUN by default) ────────────
-- Runs inside a transaction that ROLLS BACK. Review the before/after report SELECTs,
-- then change ROLLBACK -> COMMIT to apply for real.
BEGIN;

-- Report: how many rows will be backfilled vs. left NULL (pre-terms accounts)
SELECT
  count(*) FILTER (WHERE created_at >= TIMESTAMP '2026-06-21 00:00:00') AS will_backfill,
  count(*) FILTER (WHERE created_at <  TIMESTAMP '2026-06-21 00:00:00') AS pre_terms_left_null,
  min(created_at) FILTER (WHERE created_at < TIMESTAMP '2026-06-21 00:00:00') AS oldest_pre_terms
FROM trainers
WHERE terms_accepted_at IS NULL;

UPDATE trainers
SET terms_accepted_at = created_at,
    terms_version     = '2026-06-21'
WHERE terms_accepted_at IS NULL
  AND created_at >= TIMESTAMP '2026-06-21 00:00:00';

-- Report: resulting consent coverage
SELECT
  count(*)                                         AS total_trainers,
  count(*) FILTER (WHERE terms_accepted_at IS NOT NULL) AS with_consent,
  count(*) FILTER (WHERE terms_accepted_at IS NULL)     AS without_consent
FROM trainers;

ROLLBACK;  -- change to COMMIT to apply the backfill
