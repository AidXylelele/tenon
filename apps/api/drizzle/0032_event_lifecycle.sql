ALTER TABLE "event" ADD COLUMN "lifecycle" text;--> statement-breakpoint
UPDATE "event" SET "lifecycle" = substring("type" from '^org\.open-workflow-specification\.(.+)\.v1$') WHERE "origin" = 'lifecycle';
