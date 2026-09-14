-- ------------------------------------------------------------
-- add-client-events-table.sql  (Phase 18 — first-party product telemetry)
--
-- ✅ APPLIED TO PROD 2026-09-14 (6 columns verified). Safe to re-run: no-op.
-- Drizzle equivalent: drizzle/0006_condemned_alex_power.sql (prod applies via psql).
--
-- Additive, idempotent. Creates the client_events table the app writes to via
-- POST /telemetry: a few usage counters (offline cache hits, queue flushes,
-- sessions completed, records detected, installs). Stored in the product DB —
-- no third-party analytics. Row shape mirrors a vendor `capture` call so a sink
-- can be added later by field mapping.
--
-- Schema-only, so a plain statement list (the BEGIN…ROLLBACK convention is
-- for data migrations). Drizzle migration generated locally with
-- `cd apps/backend && npx drizzle-kit generate` and committed alongside.
--
-- Run:  psql "<DATABASE_PUBLIC_URL>" -v ON_ERROR_STOP=1 -P pager=off \
--         -f docs/sql/add-client-events-table.sql
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "client_events" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trainer_id" uuid NOT NULL,
  "name"       text NOT NULL,
  "props"      jsonb,
  "client_ts"  timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_events"
    ADD CONSTRAINT "client_events_trainer_id_trainers_id_fk"
    FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "client_events_trainer_name_ts_idx"
  ON "client_events" USING btree ("trainer_id", "name", "created_at");

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'client_events'
ORDER BY ordinal_position;
