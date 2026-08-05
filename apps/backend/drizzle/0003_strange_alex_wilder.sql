DO $$ BEGIN
 CREATE TYPE "public"."laterality" AS ENUM('bilateral', 'unilateral');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "laterality" "laterality" DEFAULT 'bilateral' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN IF NOT EXISTS "track_per_side" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "per_side" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "reps_left" integer;--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "reps_right" integer;