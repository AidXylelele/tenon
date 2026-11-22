CREATE TABLE "workflow_instance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"starter_id" uuid,
	"origin_id" uuid,
	"input" jsonb,
	"phase" text NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_progress" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"sequence" bigserial NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "task_progress_instance_id_execution_pk" PRIMARY KEY("instance_id","execution")
);
--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_version_id_workflow_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."workflow_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress" ADD CONSTRAINT "task_progress_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_instance_created_idx" ON "workflow_instance" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_instance_workflow_idx" ON "workflow_instance" USING btree ("workflow_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_progress_sequence_idx" ON "task_progress" USING btree ("instance_id","sequence");