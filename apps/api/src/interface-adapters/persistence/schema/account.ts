import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AccountType } from '../../../domain/enums.js';
import type { AccountConfig } from '../../interfaces.js';
import { user } from './user.js';

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').$type<AccountType>().notNull(),
    identifier: text('identifier').notNull(),
    config: jsonb('config').$type<AccountConfig>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check('account_type_check', sql`${table.type} in ('password', 'oidc')`),
    unique('account_type_identifier_key').on(table.type, table.identifier),
    uniqueIndex('account_user_password_idx')
      .on(table.userId)
      .where(sql`${table.type} = 'password'`),
  ],
);
