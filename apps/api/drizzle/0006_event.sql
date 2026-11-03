CREATE TABLE "event" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"origin" text NOT NULL,
	"instance_id" uuid,
	"cloud_event" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_source_id_idx" ON "event" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "event_instance_idx" ON "event" USING btree ("instance_id","sequence");