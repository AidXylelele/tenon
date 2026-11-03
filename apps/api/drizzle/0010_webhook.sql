CREATE TABLE "webhook" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"token_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_token_idx" ON "webhook" USING btree ("token_fingerprint");