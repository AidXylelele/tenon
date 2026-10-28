CREATE TABLE "idempotency_key" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"owner" text,
	"response" json,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key" USING btree ("expires_at");