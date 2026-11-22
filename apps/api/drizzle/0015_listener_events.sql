CREATE TABLE "listener_event" (
	"instance_id" uuid NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"sequence" bigint NOT NULL,
	CONSTRAINT "listener_event_instance_id_key_position_pk" PRIMARY KEY("instance_id","key","position"),
	CONSTRAINT "listener_event_sequence_unique" UNIQUE("instance_id","key","sequence")
);
--> statement-breakpoint
ALTER TABLE "listener_event" ADD CONSTRAINT "listener_event_sequence_event_sequence_fk" FOREIGN KEY ("sequence") REFERENCES "public"."event"("sequence") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener_event" ADD CONSTRAINT "listener_event_instance_id_key_listener_instance_id_key_fk" FOREIGN KEY ("instance_id","key") REFERENCES "public"."listener"("instance_id","key") ON DELETE cascade ON UPDATE no action;