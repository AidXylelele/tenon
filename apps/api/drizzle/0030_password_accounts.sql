ALTER TABLE "account" DROP CONSTRAINT "account_type_identifier_key";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_type_check";--> statement-breakpoint
DROP INDEX "account_user_password_idx";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "password_hash" text;--> statement-breakpoint
UPDATE "account" SET "password_hash" = "config" ->> 'passwordHash' WHERE "type" = 'password';--> statement-breakpoint
DELETE FROM "account" WHERE "password_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "config";--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_identifier_unique" UNIQUE("identifier");
