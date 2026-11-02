DROP INDEX "workflow_instance_started_idx";--> statement-breakpoint
CREATE INDEX "workflow_instance_phase_started_idx" ON "workflow_instance" USING btree ("phase","started_at","id");--> statement-breakpoint
CREATE INDEX "workflow_instance_started_idx" ON "workflow_instance" USING btree ("started_at","id");