import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// A webhook: its URL's token is kept only as a fingerprint, by which a call finds it (FR-024).
export const webhook = pgTable(
  'webhook',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    eventType: text('event_type').notNull(),
    tokenFingerprint: text('token_fingerprint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('webhook_token_idx').on(table.tokenFingerprint)],
);
