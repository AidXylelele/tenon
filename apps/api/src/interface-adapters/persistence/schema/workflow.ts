import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const workflow = pgTable(
  'workflow',
  {
    id: uuid('id').primaryKey(),
    namespace: text('namespace').notNull(),
    name: text('name').notNull(),
    isOn: boolean('is_on').notNull().default(false),
    currentVersionId: uuid('current_version_id'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('workflow_namespace_name_idx').on(table.namespace, table.name),
  ],
);
