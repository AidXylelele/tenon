import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { StepStatus } from '../../../domain/enums.js';
import type { NodeFailure, StepOutput } from '../../../domain/interfaces.js';
import { run } from './run.js';

export const step = pgTable(
  'step',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    status: text('status').$type<StepStatus>().notNull(),
    attempts: integer('attempts').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    outputs: jsonb('outputs').$type<StepOutput[]>().notNull(),
    error: jsonb('error').$type<NodeFailure>(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.nodeId] }),
    check(
      'step_status_check',
      sql`${table.status} in ('running', 'succeeded', 'failed', 'skipped')`,
    ),
  ],
);
