import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { type Role, UserStatus } from '../../../domain/enums.js';

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role').$type<Role>().notNull(),
    status: text('status')
      .$type<UserStatus>()
      .notNull()
      .default(UserStatus.Active),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'user_role_check',
      sql`${table.role} in ('admin', 'editor', 'viewer')`,
    ),
    check('user_status_check', sql`${table.status} in ('active', 'suspended')`),
  ],
);
