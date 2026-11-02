import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  JsonObject,
  JsonValue,
} from '../../../domain/automation/language/interfaces.js';
import type { TaskProgressState, WorkflowErrorState } from '../interfaces.js';
import { workflowInstance } from './workflow-instance.js';

export const taskInstance = pgTable(
  'task_instance',
  {
    id: uuid('id').primaryKey(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => workflowInstance.id, { onDelete: 'cascade' }),
    execution: integer('execution').notNull(),
    reference: text('reference').notNull(),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    phase: text('phase'),
    rawInput: jsonb('raw_input').$type<JsonValue>(),
    variables: jsonb('variables').$type<JsonObject>().notNull(),
    output: jsonb('output').$type<JsonValue>(),
    error: jsonb('error').$type<WorkflowErrorState>(),
    retries: integer('retries').notNull(),
    progress: jsonb('progress').$type<TaskProgressState>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('task_instance_instance_execution_idx').on(
      table.instanceId,
      table.execution,
    ),
    index('task_instance_active_idx')
      .on(table.instanceId, table.execution)
      .where(sql`${table.endedAt} is null`),
  ],
);
