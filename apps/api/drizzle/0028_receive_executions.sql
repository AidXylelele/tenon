ALTER TABLE "received_message" RENAME COLUMN "subscription" TO "execution";--> statement-breakpoint
ALTER TABLE "receiver" RENAME COLUMN "subscription" TO "execution";--> statement-breakpoint
ALTER TABLE "received_message" DROP CONSTRAINT "received_message_instance_id_subscription_position_pk";--> statement-breakpoint
ALTER TABLE "receiver" DROP CONSTRAINT "receiver_instance_id_subscription_pk";--> statement-breakpoint
ALTER TABLE "received_message" ADD CONSTRAINT "received_message_instance_id_execution_position_pk" PRIMARY KEY("instance_id","execution","position");--> statement-breakpoint
ALTER TABLE "receiver" ADD CONSTRAINT "receiver_instance_id_execution_pk" PRIMARY KEY("instance_id","execution");