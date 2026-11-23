CREATE SEQUENCE "public"."lock_fencing_token_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"identifier" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "account_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "account_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
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
CREATE TABLE "email_token" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"fingerprint" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"owner" text,
	"response" json,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitation_role_check" CHECK ("invitation"."role" in ('admin', 'editor', 'viewer')),
	CONSTRAINT "invitation_status_check" CHECK ("invitation"."status" in ('pending', 'accepted', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "lock" (
	"key" text PRIMARY KEY NOT NULL,
	"owner" text,
	"fencing_token" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone NOT NULL,
	"mfa" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("user"."role" in ('admin', 'editor', 'viewer')),
	CONSTRAINT "user_status_check" CHECK ("user"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"turned_on" boolean DEFAULT false NOT NULL,
	"current_version_id" uuid,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"semver" text NOT NULL,
	"dsl" text NOT NULL,
	"document" jsonb NOT NULL,
	"imports" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"digest" text NOT NULL,
	"program_fingerprint" text NOT NULL,
	"schedule" jsonb,
	"secrets" text[] NOT NULL,
	"source" text,
	"publisher_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"test" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"starter_id" uuid,
	"origin_id" uuid,
	"origin_effect_id" text,
	"input" jsonb,
	"phase" text NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"run_state" text,
	"run_format" integer,
	"program_fingerprint" text,
	"run_waits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancel_reason" text,
	"test" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"origin" text NOT NULL,
	"instance_id" uuid,
	"execution" text,
	"lifecycle" text,
	"cloud_event" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listener" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"effect_id" text NOT NULL,
	"stream" text NOT NULL,
	"position" integer NOT NULL,
	"open" jsonb NOT NULL,
	"since" timestamp with time zone NOT NULL,
	CONSTRAINT "listener_instance_id_execution_pk" PRIMARY KEY("instance_id","execution")
);
--> statement-breakpoint
CREATE TABLE "received_message" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"position" integer NOT NULL,
	"sealed_inbound" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "received_message_instance_id_execution_position_pk" PRIMARY KEY("instance_id","execution","position")
);
--> statement-breakpoint
CREATE TABLE "receiver" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"request" jsonb NOT NULL,
	"closes_at" timestamp with time zone,
	"next_position" integer DEFAULT 0 NOT NULL,
	"awaiting" integer,
	"fence" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "receiver_instance_id_execution_pk" PRIMARY KEY("instance_id","execution")
);
--> statement-breakpoint
CREATE TABLE "task_value" (
	"instance_id" uuid NOT NULL,
	"execution" text NOT NULL,
	"kind" text NOT NULL,
	"sealed_value" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_value_instance_id_execution_kind_pk" PRIMARY KEY("instance_id","execution","kind")
);
--> statement-breakpoint
CREATE TABLE "webhook" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"token_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sealed" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
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
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_token" ADD CONSTRAINT "email_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_user_id_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_publisher_id_user_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance" ADD CONSTRAINT "workflow_instance_version_id_workflow_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."workflow_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listener" ADD CONSTRAINT "listener_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_message" ADD CONSTRAINT "received_message_instance_id_execution_receiver_instance_id_execution_fk" FOREIGN KEY ("instance_id","execution") REFERENCES "public"."receiver"("instance_id","execution") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiver" ADD CONSTRAINT "receiver_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_value" ADD CONSTRAINT "task_value_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret" ADD CONSTRAINT "secret_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_token_expires_idx" ON "email_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_pending_email_idx" ON "invitation" USING btree ("email") WHERE "invitation"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_namespace_name_idx" ON "workflow" USING btree ("namespace","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_version_workflow_semver_idx" ON "workflow_version" USING btree ("workflow_id","semver") WHERE not "workflow_version"."test";--> statement-breakpoint
CREATE INDEX "workflow_instance_started_idx" ON "workflow_instance" USING btree ("started_at","created_at","id","phase","workflow_id","test","ended_at");--> statement-breakpoint
CREATE INDEX "workflow_instance_workflow_started_idx" ON "workflow_instance" USING btree ("workflow_id","started_at","created_at","id","phase","test","ended_at");--> statement-breakpoint
CREATE INDEX "workflow_instance_live_idx" ON "workflow_instance" USING btree ("phase","workflow_id","test") WHERE "workflow_instance"."phase" in ('pending', 'running', 'waiting', 'suspended');--> statement-breakpoint
CREATE INDEX "workflow_instance_scheduled_idx" ON "workflow_instance" USING btree ("workflow_id","created_at") WHERE "workflow_instance"."trigger" = 'schedule';--> statement-breakpoint
CREATE INDEX "workflow_instance_workflow_idx" ON "workflow_instance" USING btree ("workflow_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_instance_origin_idx" ON "workflow_instance" USING btree ("origin_id","origin_effect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_source_id_idx" ON "event" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "event_instance_idx" ON "event" USING btree ("instance_id","sequence");--> statement-breakpoint
CREATE INDEX "listener_stream_idx" ON "listener" USING btree ("stream");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_token_idx" ON "webhook" USING btree ("token_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "secret_owner_name_idx" ON "secret" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "delivery_recent_idx" ON "delivery" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_owner_idx" ON "subscription" USING btree ("owner_id");