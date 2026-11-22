CREATE TABLE "listener" (
	"instance_id" uuid NOT NULL,
	"key" text NOT NULL,
	"types" text[],
	"since" timestamp with time zone NOT NULL,
	CONSTRAINT "listener_instance_id_key_pk" PRIMARY KEY("instance_id","key")
);
--> statement-breakpoint
ALTER TABLE "listener" ADD CONSTRAINT "listener_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listener_types_idx" ON "listener" USING gin ("types");