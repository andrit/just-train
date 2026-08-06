ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "circuit_id" uuid;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN IF NOT EXISTS "circuit_id" uuid;