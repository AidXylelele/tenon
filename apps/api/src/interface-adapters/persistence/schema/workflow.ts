import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  GraphProps,
  WorkflowSettings,
} from '../../../domain/interfaces.js';
import { user } from './user.js';

export const workflow = pgTable(
  'workflow',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    graph: jsonb('graph').$type<GraphProps>().notNull(),
    settings: jsonb('settings').$type<WorkflowSettings>().notNull(),
    revision: integer('revision').notNull(),
    pinnedNodeIds: text('pinned_node_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    latestRelease: integer('latest_release').notNull().default(0),
    activeRelease: integer('active_release'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('workflow_list_idx').on(table.updatedAt.desc(), table.id.desc()),
    index('workflow_owner_idx').on(table.ownerId),
    index('workflow_name_idx').on(sql`lower(${table.name})`),
    index('workflow_active_idx')
      .on(table.id)
      .where(sql`${table.activeRelease} is not null`),
  ],
);
