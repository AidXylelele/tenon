DROP INDEX "workflow_version_workflow_semver_idx";--> statement-breakpoint
ALTER TABLE "workflow_version" ADD COLUMN "test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD COLUMN "test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_workflow_semver_idx" ON "workflow_version" USING btree ("workflow_id","semver") WHERE not "workflow_version"."test";