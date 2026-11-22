ALTER TABLE "listener" RENAME COLUMN "subscription" TO "execution";--> statement-breakpoint
ALTER TABLE "listener" DROP CONSTRAINT "listener_instance_id_subscription_pk";--> statement-breakpoint
ALTER TABLE "listener" ADD CONSTRAINT "listener_instance_id_execution_pk" PRIMARY KEY("instance_id","execution");