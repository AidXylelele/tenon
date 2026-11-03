import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { JsonObject } from '../../../domain/automation/json.js';
import { user } from './user.js';
import { workflow } from './workflow.js';

export const workflowVersion = pgTable(
  'workflow_version',
  {
    id: uuid('id').primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id),
    semver: text('semver').notNull(),
    dsl: text('dsl').notNull(),
    document: jsonb('document').$type<JsonObject>().notNull(),
    fingerprint: text('fingerprint').notNull(),
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => user.id),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('workflow_version_workflow_semver_idx').on(
      table.workflowId,
      table.semver,
    ),
  ],
);
