-- Change email (account plan B7): a pending address on the trainer (display /
-- cancel) and the target address on the verification token (the swap trusts
-- the token, never the trainer row). Both additive + nullable.
--
-- Apply BEFORE deploying the code: login reads `trainers` via findFirst
-- (selects every column), so code that knows `pending_email` fails against a
-- database without it. Idempotent — safe to re-run.

ALTER TABLE trainers                  ADD COLUMN IF NOT EXISTS pending_email text;
ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS new_email     text;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name = 'trainers' AND column_name = 'pending_email')
   OR (table_name = 'email_verification_tokens' AND column_name = 'new_email');
