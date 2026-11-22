CREATE TABLE "delivery" (
	"subscription_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"first_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "delivery_subscription_id_sequence_pk" PRIMARY KEY("subscription_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"endpoint" jsonb NOT NULL,
	"filter" jsonb NOT NULL,
	"types" text[],
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_recent_idx" ON "delivery" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_owner_idx" ON "subscription" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "subscription_types_idx" ON "subscription" USING gin ("types");