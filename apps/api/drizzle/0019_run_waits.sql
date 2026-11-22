ALTER TABLE "workflow_instance" ADD COLUMN "run_waits" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "cancel_reason" text;