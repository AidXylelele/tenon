import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { RunMode, RunStatus, TriggerType } from '../../../domain/enums.js';
import type {
  GraphProps,
  PinnedOutput,
  RunError,
  StepOutput,
} from '../../../domain/interfaces.js';
import { user } from './user.js';
import { workflow } from './workflow.js';

export const run = pgTable(
  'run',
  {
    id: uuid('id').primaryKey(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflow.id),
    workflowName: text('workflow_name').notNull(),
    releaseNumber: integer('release_number'),
    mode: text('mode').$type<RunMode>().notNull(),
    triggerType: text('trigger_type').$type<TriggerType>().notNull(),
    triggerNodeId: text('trigger_node_id').notNull(),
    triggerKey: text('trigger_key'),
    actingUserId: uuid('acting_user_id')
      .notNull()
      .references(() => user.id),
    status: text('status').$type<RunStatus>().notNull(),
    error: jsonb('error').$type<RunError>(),
    graphSnapshot: jsonb('graph_snapshot').$type<GraphProps>(),
    input: jsonb('input').$type<StepOutput[]>().notNull(),
    pins: jsonb('pins').$type<PinnedOutput[]>().notNull(),
    timeoutMs: integer('timeout_ms').notNull(),
    timezone: text('timezone').notNull(),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check('run_mode_check', sql`${table.mode} in ('test', 'production')`),
    check(
      'run_status_check',
      sql`${table.status} in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')`,
    ),
    index('run_list_idx').on(
      table.workflowId,
      table.queuedAt.desc(),
      table.id.desc(),
    ),
    index('run_unfinished_idx')
      .on(table.updatedAt)
      .where(sql`${table.status} in ('queued', 'running', 'waiting')`),
  ],
);
