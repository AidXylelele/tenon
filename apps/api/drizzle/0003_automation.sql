CREATE TABLE "idempotency_key" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"owner" text,
	"response" json,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_sample" (
	"workflow_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"pinned" jsonb,
	"fields" jsonb NOT NULL,
	"fields_source" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "node_sample_workflow_id_node_id_pk" PRIMARY KEY("workflow_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "release" (
	"workflow_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"graph" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"credential_ids" uuid[] NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" uuid NOT NULL,
	CONSTRAINT "release_workflow_id_number_pk" PRIMARY KEY("workflow_id","number")
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_name" text NOT NULL,
	"release_number" integer,
	"mode" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_node_id" text NOT NULL,
	"trigger_key" text,
	"acting_user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"error" jsonb,
	"graph_snapshot" jsonb,
	"input" jsonb NOT NULL,
	"pins" jsonb NOT NULL,
	"timeout_ms" integer NOT NULL,
	"timezone" text NOT NULL,
	"queued_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "run_mode_check" CHECK ("run"."mode" in ('test', 'production')),
	CONSTRAINT "run_status_check" CHECK ("run"."status" in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "step" (
	"run_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"outputs" jsonb NOT NULL,
	"error" jsonb,
	CONSTRAINT "step_run_id_node_id_pk" PRIMARY KEY("run_id","node_id"),
	CONSTRAINT "step_status_check" CHECK ("step"."status" in ('running', 'succeeded', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"secret_key_version" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"graph" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"pinned_node_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"latest_release" integer DEFAULT 0 NOT NULL,
	"active_release" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "node_sample" ADD CONSTRAINT "node_sample_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_acting_user_id_user_id_fk" FOREIGN KEY ("acting_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step" ADD CONSTRAINT "step_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "run_list_idx" ON "run" USING btree ("workflow_id","queued_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "run_unfinished_idx" ON "run" USING btree ("updated_at") WHERE "run"."status" in ('queued', 'running', 'waiting');--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_endpoint_node_idx" ON "webhook_endpoint" USING btree ("workflow_id","node_id");--> statement-breakpoint
CREATE INDEX "workflow_list_idx" ON "workflow" USING btree ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_owner_idx" ON "workflow" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "workflow_name_idx" ON "workflow" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "workflow_active_idx" ON "workflow" USING btree ("id") WHERE "workflow"."active_release" is not null;