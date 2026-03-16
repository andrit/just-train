DO $$ BEGIN
 CREATE TYPE "public"."client_focus" AS ENUM('cardio', 'resistance', 'calisthenics', 'mixed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."progression_state" AS ENUM('assessment', 'programming', 'maintenance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'pastDue', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro', 'studio');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trainer_mode" AS ENUM('athlete', 'trainer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trainer_role" AS ENUM('trainer', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."weight_unit" AS ENUM('lbs', 'kg');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."body_part" AS ENUM('arms', 'back', 'chest', 'legs', 'shoulders', 'core', 'full_body');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."equipment" AS ENUM('none', 'bodyweight', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'resistance_band', 'cardio_machine', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."media_type" AS ENUM('image', 'video');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."workout_type" AS ENUM('cardio', 'stretching', 'calisthenics', 'resistance', 'cooldown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."intensity_level" AS ENUM('low', 'moderate', 'high', 'max');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."side" AS ENUM('left', 'right', 'both');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"photo_url" text,
	"date_of_birth" text,
	"goals" text,
	"notes" text,
	"primary_focus" "client_focus",
	"secondary_focus" "client_focus",
	"progression_state" "progression_state" DEFAULT 'assessment' NOT NULL,
	"start_date" text,
	"caloric_goal" integer,
	"nutrition_notes" text,
	"is_self" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "trainer_role" DEFAULT 'trainer' NOT NULL,
	"weight_unit_preference" "weight_unit" DEFAULT 'lbs' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"onboarded_at" timestamp,
	"trainer_mode" "trainer_mode" DEFAULT 'trainer' NOT NULL,
	"reports_sent_count" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp,
	"cta_label" text DEFAULT 'Start Training' NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"widget_progression" text,
	"alert_color_scheme" text DEFAULT 'amber' NOT NULL,
	"alert_tone" text DEFAULT 'clinical' NOT NULL,
	"session_layout" text DEFAULT 'horizontal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trainers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"progression_state" "progression_state" DEFAULT 'assessment' NOT NULL,
	"set_at" timestamp DEFAULT now() NOT NULL,
	"achieved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"captured_by" uuid NOT NULL,
	"progression_state" "progression_state" DEFAULT 'assessment' NOT NULL,
	"weight_lbs" real,
	"height_in" real,
	"body_fat_pct" real,
	"lean_muscle_mass_lbs" real,
	"bmi" real,
	"waist_in" real,
	"hips_in" real,
	"chest_in" real,
	"biceps_left_in" real,
	"biceps_right_in" real,
	"quads_left_in" real,
	"quads_right_in" real,
	"calves_left_in" real,
	"calves_right_in" real,
	"resting_heart_rate_bpm" integer,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"vo2_max_estimate" real,
	"max_push_ups" integer,
	"max_pull_ups" integer,
	"plank_duration_secs" integer,
	"mile_time_secs" integer,
	"sit_and_reach_in" real,
	"grip_strength_left_lbs" real,
	"grip_strength_right_lbs" real,
	"energy_level" integer,
	"sleep_quality" integer,
	"stress_level" integer,
	"mobility_feel" integer,
	"self_image_score" integer,
	"trainer_notes" text,
	"client_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trainer_usage_monthly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"active_client_count" integer DEFAULT 0 NOT NULL,
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"total_sets_logged" integer DEFAULT 0 NOT NULL,
	"snapshots_taken" integer DEFAULT 0 NOT NULL,
	"reports_generated" integer DEFAULT 0 NOT NULL,
	"goals_actioned" integer DEFAULT 0 NOT NULL,
	"total_client_count" integer DEFAULT 0 NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trainer_usage_monthly_trainer_period" UNIQUE("trainer_id","period_year","period_month")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "body_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "body_part" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "body_parts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercise_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"media_type" "media_type" NOT NULL,
	"cloudinary_url" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text,
	"body_part_id" uuid NOT NULL,
	"workout_type" "workout_type" NOT NULL,
	"equipment" "equipment" DEFAULT 'none' NOT NULL,
	"difficulty" "difficulty" DEFAULT 'beginner' NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"target_sets" integer,
	"target_reps" integer,
	"target_weight" real,
	"target_weight_unit" "weight_unit" DEFAULT 'lbs' NOT NULL,
	"target_duration_seconds" integer,
	"target_distance" real,
	"target_intensity" "intensity_level",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"workout_type" "workout_type" NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"target_sets" integer,
	"target_reps" integer,
	"target_weight" real,
	"target_weight_unit" "weight_unit" DEFAULT 'lbs' NOT NULL,
	"target_duration_seconds" integer,
	"target_distance" real,
	"target_intensity" "intensity_level",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"trainer_id" uuid NOT NULL,
	"template_id" uuid,
	"name" text,
	"date" text NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"status" "session_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"energy_level" integer,
	"mobility_feel" integer,
	"stress_level" integer,
	"session_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer,
	"weight" real,
	"weight_unit" "weight_unit" DEFAULT 'lbs' NOT NULL,
	"duration_seconds" integer,
	"distance" real,
	"speed" real,
	"intensity" "intensity_level",
	"side" "side",
	"rpe" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"payload" text NOT NULL,
	"created_locally_at" timestamp NOT NULL,
	"synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"workout_type" "workout_type" NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_snapshots" ADD CONSTRAINT "client_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_snapshots" ADD CONSTRAINT "client_snapshots_captured_by_trainers_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."trainers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trainer_usage_monthly" ADD CONSTRAINT "trainer_usage_monthly_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercises" ADD CONSTRAINT "exercises_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercises" ADD CONSTRAINT "exercises_body_part_id_body_parts_id_fk" FOREIGN KEY ("body_part_id") REFERENCES "public"."body_parts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_workout_id_template_workouts_id_fk" FOREIGN KEY ("template_workout_id") REFERENCES "public"."template_workouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_workouts" ADD CONSTRAINT "template_workouts_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "templates" ADD CONSTRAINT "templates_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sets" ADD CONSTRAINT "sets_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workouts" ADD CONSTRAINT "workouts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
