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
  Phase,
  TriggerKind,
} from '../../../domain/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import { workflow } from './workflow.js';
import { workflowVersion } from './workflow-version.js';

export const workflowInstance = pgTable(
  'workflow_instance',
  {
    id: uuid('id').primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id),
    versionId: uuid('version_id')
      .notNull()
      .references(() => workflowVersion.id),
    trigger: text('trigger').$type<TriggerKind>().notNull(),
    starterId: uuid('starter_id'),
    originId: uuid('origin_id'),
    input: jsonb('input').$type<JsonValue>(),
    phase: text('phase').$type<Phase>().notNull(),
    output: jsonb('output').$type<JsonValue>(),
    error: jsonb('error').$type<JsonObject>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('workflow_instance_created_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('workflow_instance_workflow_idx').on(
      table.workflowId,
      table.createdAt.desc(),
    ),
  ],
);
