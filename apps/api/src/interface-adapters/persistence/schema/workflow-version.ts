import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ParsedDocument } from '../../../domain/automation/language/interfaces.js';
import type { DocumentFormat } from '../../../domain/automation/workflows/interfaces.js';
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
    dslVersion: text('dsl_version').notNull(),
    sourceFormat: text('source_format').$type<DocumentFormat>().notNull(),
    sourceText: text('source_text').notNull(),
    fingerprint: text('fingerprint').notNull(),
    definition: jsonb('definition').$type<ParsedDocument>().notNull(),
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
