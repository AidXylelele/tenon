import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const webhook = pgTable(
  "webhook",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    eventType: text("event_type").notNull(),
    tokenFingerprint: text("token_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("webhook_token_idx").on(table.tokenFingerprint)],
);
