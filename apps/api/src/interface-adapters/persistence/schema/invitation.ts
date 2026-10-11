import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './user.js';

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => user.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedUserId: uuid('accepted_user_id').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check(
      'invitation_role_check',
      sql`${table.role} in ('admin', 'editor', 'viewer')`,
    ),
    check(
      'invitation_status_check',
      sql`${table.status} in ('pending', 'accepted', 'revoked')`,
    ),
    uniqueIndex('invitation_pending_email_idx')
      .on(table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);
