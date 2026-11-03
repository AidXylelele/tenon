import {
  bigserial,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TaskStatus } from '../../../application/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import { workflowInstance } from './workflow-instance.js';

// The progress view: one row per execution of a task (an iteration, an attempt, a later visit),
// written as the runtime reports it.
export const taskProgress = pgTable(
  'task_progress',
  {
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => workflowInstance.id, { onDelete: 'cascade' }),
    execution: text('execution').notNull(),
    sequence: bigserial('sequence', { mode: 'number' }).notNull(),
    reference: text('reference').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<TaskStatus>().notNull(),
    input: jsonb('input').$type<JsonValue>(),
    output: jsonb('output').$type<JsonValue>(),
    error: jsonb('error').$type<JsonObject>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.instanceId, table.execution] }),
    index('task_progress_sequence_idx').on(table.instanceId, table.sequence),
  ],
);
