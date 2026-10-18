import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { FieldShape, Item } from '../../../application/interfaces.js';
import { workflow } from './workflow.js';

export const nodeSample = pgTable(
  'node_sample',
  {
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    pinned: jsonb('pinned').$type<Item[]>(),
    fields: jsonb('fields').$type<FieldShape[]>().notNull(),
    fieldsSource: text('fields_source').$type<'pin' | 'test-run'>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.workflowId, table.nodeId] })],
);
