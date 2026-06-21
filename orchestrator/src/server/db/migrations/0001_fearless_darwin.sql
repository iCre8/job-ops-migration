ALTER TABLE "jobs" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_verdict" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_score" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_priority" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_details" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_outreach_message" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verification_run_at" timestamp with time zone;