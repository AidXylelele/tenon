import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './user.js';

export const emailToken = pgTable('email_token', {
  id: text('id').primaryKey(),
  purpose: text('purpose').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  fingerprint: text('fingerprint'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
