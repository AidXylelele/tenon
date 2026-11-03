import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { WorkflowStatus } from '../../../domain/automation/workflows/enums.js';

export const workflow = pgTable(
  'workflow',
  {
    id: uuid('id').primaryKey(),
    namespace: text('namespace').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<WorkflowStatus>().notNull(),
    on: boolean('turned_on').notNull().default(false),
    currentVersionId: uuid('current_version_id'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('workflow_namespace_name_idx').on(table.namespace, table.name),
  ],
);
