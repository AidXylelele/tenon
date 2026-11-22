CREATE TABLE "received_message" (
	"instance_id" uuid NOT NULL,
	"subscription" text NOT NULL,
	"position" integer NOT NULL,
	"message" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "received_message_instance_id_subscription_position_pk" PRIMARY KEY("instance_id","subscription","position")
);
--> statement-breakpoint
CREATE TABLE "receiver" (
	"instance_id" uuid NOT NULL,
	"subscription" text NOT NULL,
	"request" jsonb NOT NULL,
	"closes_at" timestamp with time zone,
	CONSTRAINT "receiver_instance_id_subscription_pk" PRIMARY KEY("instance_id","subscription")
);
--> statement-breakpoint
ALTER TABLE "received_message" ADD CONSTRAINT "received_message_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiver" ADD CONSTRAINT "receiver_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;