ALTER TABLE "trainers" ADD COLUMN "pending_email" text;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD COLUMN "new_email" text;