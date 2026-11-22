CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"current_version_id" uuid,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"semver" text NOT NULL,
	"dsl" text NOT NULL,
	"document" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"publisher_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_publisher_id_user_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_namespace_name_idx" ON "workflow" USING btree ("namespace","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_workflow_semver_idx" ON "workflow_version" USING btree ("workflow_id","semver");