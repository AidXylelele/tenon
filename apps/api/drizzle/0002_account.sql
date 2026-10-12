CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"identifier" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "account_type_identifier_key" UNIQUE("type","identifier"),
	CONSTRAINT "account_type_check" CHECK ("account"."type" in ('password', 'oidc'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_user_password_idx" ON "account" USING btree ("user_id") WHERE "account"."type" = 'password';--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_status_check" CHECK ("user"."status" in ('active', 'suspended'));--> statement-breakpoint
INSERT INTO "account" ("id", "user_id", "type", "identifier", "config", "created_at", "updated_at", "version")
SELECT gen_random_uuid(), "id", 'password', "email", jsonb_build_object('passwordHash', "password_hash"), "created_at", now(), 1
FROM "user"
WHERE "password_hash" IS NOT NULL;--> statement-breakpoint
UPDATE "user" SET "status" = 'suspended' WHERE "suspended";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "suspended";