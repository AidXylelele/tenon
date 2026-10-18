import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  GraphProps,
  WorkflowSettings,
} from '../../../domain/interfaces.js';
import { user } from './user.js';
import { workflow } from './workflow.js';

export const release = pgTable(
  'release',
  {
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id),
    number: integer('number').notNull(),
    graph: jsonb('graph').$type<GraphProps>().notNull(),
    settings: jsonb('settings').$type<WorkflowSettings>().notNull(),
    credentialIds: uuid('credential_ids').array().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    publishedBy: uuid('published_by')
      .notNull()
      .references(() => user.id),
  },
  (table) => [primaryKey({ columns: [table.workflowId, table.number] })],
);
