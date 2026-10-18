import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { workflow } from './workflow.js';

export const webhookEndpoint = pgTable(
  'webhook_endpoint',
  {
    id: text('id').primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id),
    nodeId: text('node_id').notNull(),
    secretCiphertext: text('secret_ciphertext').notNull(),
    secretKeyVersion: text('secret_key_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('webhook_endpoint_node_idx').on(table.workflowId, table.nodeId),
  ],
);
