ALTER TABLE "task_progress" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_progress" ADD COLUMN "retry_at" timestamp with time zone;