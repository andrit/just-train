-- ------------------------------------------------------------
-- add-password-reset-tokens.sql  (account plan B6 — forgot / reset password)
--
-- Additive, idempotent. Apply BEFORE deploying the code (the forgot-password
-- route inserts here). Same shape as email_verification_tokens.
--
-- Run:  psql "<DATABASE_PUBLIC_URL>" -v ON_ERROR_STOP=1 -P pager=off \
--         -f docs/sql/add-password-reset-tokens.sql
-- Drizzle migration generated locally with `cd apps/backend && npx drizzle-kit generate`.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trainer_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at"    timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_trainer_id_trainers_id_fk"
    FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_trainer_id_idx" ON "password_reset_tokens" USING btree ("trainer_id");

SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'password_reset_tokens' ORDER BY ordinal_position;
