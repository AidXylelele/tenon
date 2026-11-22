CREATE TABLE "task_value" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"kind" text NOT NULL,
	"sealed_value" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_value_instance_id_execution_kind_pk" PRIMARY KEY("instance_id","execution","kind")
);
--> statement-breakpoint
ALTER TABLE "task_value" ADD CONSTRAINT "task_value_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;