ALTER TABLE "workflow" ADD COLUMN "schedule_arming" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "scheduled_since" timestamp with time zone;--> statement-breakpoint
UPDATE "workflow" SET "scheduled_since" = now() WHERE "turned_on";
