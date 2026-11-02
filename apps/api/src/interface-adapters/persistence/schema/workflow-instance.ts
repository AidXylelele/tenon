import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { JsonValue } from '../../../domain/automation/language/interfaces.js';
import type { OriginState, WorkflowErrorState } from './interfaces.js';
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
    namespace: text('namespace').notNull(),
    name: text('name').notNull(),
    semver: text('semver').notNull(),
    phase: text('phase').notNull(),
    input: jsonb('input').$type<JsonValue>(),
    output: jsonb('output').$type<JsonValue>(),
    error: jsonb('error').$type<WorkflowErrorState>(),
    context: jsonb('context').$type<JsonValue>(),
    origin: jsonb('origin').$type<OriginState>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    sequence: integer('sequence').notNull(),
    executions: integer('executions').notNull(),
    rounds: integer('rounds').notNull().default(0),
    version: integer('version').notNull(),
  },
  (table) => [
    index('workflow_instance_name_started_idx').on(
      table.namespace,
      table.name,
      table.startedAt,
      table.id,
    ),
    index('workflow_instance_started_idx').on(table.startedAt, table.id),
    index('workflow_instance_phase_started_idx').on(
      table.phase,
      table.startedAt,
      table.id,
    ),
  ],
);
