CREATE TABLE "draft" (
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"layout" jsonb NOT NULL,
	"revision" text NOT NULL,
	"saved_by" uuid NOT NULL,
	"saved_by_name" text NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "draft_namespace_name_pk" PRIMARY KEY("namespace","name")
);
--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;