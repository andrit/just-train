ALTER TABLE "exercises" ADD COLUMN "distance_unit" text;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "target_intensity_level" integer;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "target_intensity_level" integer;--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN "intensity_level" integer;