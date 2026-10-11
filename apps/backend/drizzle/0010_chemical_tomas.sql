DO $$ BEGIN
 CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercise_muscles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"muscle" text NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "uniq_exercise_muscle" UNIQUE("exercise_id","muscle")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
