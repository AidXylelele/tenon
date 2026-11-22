DROP INDEX "workflow_instance_created_idx";--> statement-breakpoint
DROP INDEX "workflow_instance_workflow_idx";--> statement-breakpoint
CREATE INDEX "workflow_instance_created_idx" ON "workflow_instance" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_instance_workflow_idx" ON "workflow_instance" USING btree ("workflow_id","created_at","id");