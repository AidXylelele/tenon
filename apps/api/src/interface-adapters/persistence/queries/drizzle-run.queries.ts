import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, desc, eq, inArray, lt, or, type SQL } from 'drizzle-orm';
import type {
  Page,
  RunFilter,
  RunQueries,
  RunSummary,
  RunView,
} from '../../../application/interfaces.js';
import { RunStatus } from '../../../domain/enums.js';
import { RunNotFoundError } from '../../../domain/errors.js';
import type { DrizzleTx, RunRow } from '../../interfaces.js';
import { run as runs, step as steps } from '../schema/index.js';
import { PageCursor } from './page-cursor.js';

const UNFINISHED = [RunStatus.Queued, RunStatus.Running, RunStatus.Waiting];

@Injectable()
export class DrizzleRunQueries implements RunQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(workflowId: string, filter: RunFilter): Promise<Page<RunSummary>> {
    const conditions = this.conditions(workflowId, filter);
    const take = filter.limit + 1;
    const rows = await this.txHost.tx
      .select()
      .from(runs)
      .where(and(...conditions))
      .orderBy(desc(runs.queuedAt), desc(runs.id))
      .limit(take);
    const items = rows.slice(0, filter.limit).map((row) => this.summary(row));
    const last = items.at(-1);
    const nextCursor =
      rows.length > filter.limit && last
        ? PageCursor.encode({ at: last.queuedAt, id: last.id })
        : null;
    return { items, nextCursor };
  }

  async get(id: string): Promise<RunView> {
    const [row] = await this.txHost.tx
      .select()
      .from(runs)
      .where(eq(runs.id, id));

    if (!row) throw new RunNotFoundError();

    const stepRows = await this.txHost.tx
      .select()
      .from(steps)
      .where(eq(steps.runId, id))
      .orderBy(asc(steps.startedAt));
    return {
      ...this.summary(row),
      version: row.version,
      steps: stepRows.map((step) => ({
        nodeId: step.nodeId,
        status: step.status,
        attempts: step.attempts,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt,
        outputs: step.outputs,
        error: step.error,
      })),
    };
  }

  async unfinishedBefore(moment: Date, limit: number): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ id: runs.id })
      .from(runs)
      .where(and(inArray(runs.status, UNFINISHED), lt(runs.updatedAt, moment)))
      .orderBy(asc(runs.updatedAt))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  private summary(row: RunRow): RunSummary {
    return {
      id: row.id,
      workflowId: row.workflowId,
      status: row.status,
      mode: row.mode,
      trigger: row.triggerType,
      releaseNumber: row.releaseNumber,
      queuedAt: row.queuedAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      error: row.error,
    };
  }

  private conditions(workflowId: string, filter: RunFilter): SQL[] {
    const conditions: SQL[] = [eq(runs.workflowId, workflowId)];

    if (filter.status) conditions.push(eq(runs.status, filter.status));

    const position = PageCursor.decode(filter.cursor);

    if (position) {
      conditions.push(
        or(
          lt(runs.queuedAt, position.at),
          and(eq(runs.queuedAt, position.at), lt(runs.id, position.id)),
        )!,
      );
    }

    return conditions;
  }
}
