DROP TABLE "listener_event" CASCADE;--> statement-breakpoint
DELETE FROM "listener";--> statement-breakpoint
DROP INDEX "listener_types_idx";--> statement-breakpoint
DROP INDEX "subscription_types_idx";--> statement-breakpoint
ALTER TABLE "listener" DROP CONSTRAINT "listener_instance_id_key_pk";--> statement-breakpoint
ALTER TABLE "listener" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "listener" DROP COLUMN "types";--> statement-breakpoint
ALTER TABLE "listener" ADD COLUMN "subscription" text NOT NULL;--> statement-breakpoint
ALTER TABLE "listener" ADD COLUMN "effect_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "listener" ADD COLUMN "stream" text NOT NULL;--> statement-breakpoint
ALTER TABLE "listener" ADD COLUMN "position" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "listener" ADD COLUMN "open" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listener" ADD CONSTRAINT "listener_instance_id_subscription_pk" PRIMARY KEY("instance_id","subscription");--> statement-breakpoint
CREATE INDEX "listener_stream_idx" ON "listener" USING btree ("stream");--> statement-breakpoint
ALTER TABLE "workflow_version" ADD COLUMN "program_fingerprint" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_version" ALTER COLUMN "program_fingerprint" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD COLUMN "schedule" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD COLUMN "secrets" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_version" ALTER COLUMN "secrets" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workflow_version" DROP COLUMN "event_types";--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "origin_effect_id" text;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "run_state" text;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "run_format" integer;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "program_fingerprint" text;--> statement-breakpoint
ALTER TABLE "workflow_instance" DROP COLUMN "waiting";--> statement-breakpoint
CREATE INDEX "workflow_instance_origin_idx" ON "workflow_instance" USING btree ("origin_id","origin_effect_id");--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "types";
