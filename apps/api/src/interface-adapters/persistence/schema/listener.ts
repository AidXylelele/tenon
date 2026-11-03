import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { workflowInstance } from './workflow-instance.js';

// The `listen` tasks waiting now: the events dispatched after one began reach it by its key.
export const listener = pgTable(
  'listener',
  {
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => workflowInstance.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    types: text('types').array(),
    since: timestamp('since', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instanceId, table.key] }),
    index('listener_types_idx').using('gin', table.types),
  ],
);
