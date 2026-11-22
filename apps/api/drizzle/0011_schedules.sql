ALTER TABLE "workflow" ADD COLUMN "turned_on" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD COLUMN "event_types" text[];