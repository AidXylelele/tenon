CREATE TABLE "workflow_instance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"semver" text NOT NULL,
	"phase" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" jsonb,
	"context" jsonb,
	"origin" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"sequence" integer NOT NULL,
	"executions" integer NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_instance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"instance_id" uuid NOT NULL,
	"execution" integer NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"phase" text,
	"raw_input" jsonb,
	"variables" jsonb NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"retries" integer NOT NULL,
	"progress" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"subject" text,
	"data_content_type" text,
	"data_schema" text,
	"data" jsonb,
	"extensions" jsonb NOT NULL,
	"origin_kind" text NOT NULL,
	"origin_workflow_id" uuid,
	"origin_instance_id" uuid,
	"sequence" integer,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_version_id_workflow_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."workflow_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instance" ADD CONSTRAINT "task_instance_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_instance_name_started_idx" ON "workflow_instance" USING btree ("namespace","name","started_at","id");--> statement-breakpoint
CREATE INDEX "workflow_instance_started_idx" ON "workflow_instance" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "task_instance_instance_execution_idx" ON "task_instance" USING btree ("instance_id","execution");--> statement-breakpoint
CREATE INDEX "task_instance_active_idx" ON "task_instance" USING btree ("instance_id","execution") WHERE "task_instance"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "event_source_event_id_idx" ON "event" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "event_origin_instance_sequence_idx" ON "event" USING btree ("origin_instance_id","sequence");