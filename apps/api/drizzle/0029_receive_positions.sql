ALTER TABLE "received_message" DROP CONSTRAINT "received_message_instance_id_workflow_instance_id_fk";
--> statement-breakpoint
ALTER TABLE "receiver" ADD COLUMN "next_position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "receiver" ADD COLUMN "awaiting" integer;--> statement-breakpoint
ALTER TABLE "receiver" ADD COLUMN "fence" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "receiver" SET "next_position" = (SELECT coalesce(max("position") + 1, 0) FROM "received_message" WHERE "received_message"."instance_id" = "receiver"."instance_id" AND "received_message"."execution" = "receiver"."execution");--> statement-breakpoint
DELETE FROM "received_message";--> statement-breakpoint
ALTER TABLE "received_message" ADD COLUMN "sealed_inbound" text NOT NULL;--> statement-breakpoint
ALTER TABLE "received_message" ADD CONSTRAINT "received_message_instance_id_execution_receiver_instance_id_execution_fk" FOREIGN KEY ("instance_id","execution") REFERENCES "public"."receiver"("instance_id","execution") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_message" DROP COLUMN "message";
