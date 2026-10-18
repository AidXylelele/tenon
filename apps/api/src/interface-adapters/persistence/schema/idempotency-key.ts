import { bigint, index, json, pgTable, text } from 'drizzle-orm/pg-core';

export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    keyHash: text('key_hash').primaryKey(),
    key: text('key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    owner: text('owner'),
    response: json('response'),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (table) => [index('idempotency_key_expires_at_idx').on(table.expiresAt)],
);
