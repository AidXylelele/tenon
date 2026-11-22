CREATE INDEX "email_token_expires_idx" ON "email_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "session" USING btree ("expires_at");