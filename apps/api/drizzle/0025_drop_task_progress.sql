ALTER TABLE "event" ADD COLUMN "execution" text;--> statement-breakpoint
UPDATE "event" SET "execution" = "cloud_event" -> 'data' ->> 'task' WHERE "origin" = 'lifecycle' AND "cloud_event" -> 'data' ->> 'task' IS NOT NULL;--> statement-breakpoint
DROP TABLE "task_progress" CASCADE;
