import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, sql } from 'drizzle-orm';
import type { RunRepository } from '../../../application/interfaces.js';
import {
  ReleaseNotFoundError,
  RunConflictError,
  RunNotFoundError,
} from '../../../domain/errors.js';
import type { Graph } from '../../../domain/graph.js';
import type { Run } from '../../../domain/run.js';
import type { DrizzleTx, RunRow, StepRow } from '../../interfaces.js';
import { GraphMapper } from '../mappers/graph.mapper.js';
import { RunMapper } from '../mappers/run.mapper.js';
import {
  release as releases,
  run as runs,
  step as steps,
} from '../schema/index.js';

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  readonly #stored = new WeakMap<Run, Map<string, string>>();

  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(run: Run): Promise<void> {
    const row = RunMapper.toRow(run);
    const inserted = await this.txHost.tx
      .insert(runs)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: runs.id });

    if (inserted.length === 0) throw new RunConflictError();

    await this.saveSteps(run);
  }

  async update(run: Run): Promise<void> {
    const row = RunMapper.toRow(run);
    const nextVersion = run.version + 1;
    const updated = await this.txHost.tx
      .update(runs)
      .set({ ...row, version: nextVersion })
      .where(and(eq(runs.id, run.id), eq(runs.version, run.version)))
      .returning({ id: runs.id });

    if (updated.length === 0) throw new RunConflictError();

    await this.saveSteps(run);
  }

  async getById(id: string): Promise<Run> {
    const run = await this.findById(id);

    if (!run) throw new RunNotFoundError();

    return run;
  }

  async findById(id: string): Promise<Run | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(runs)
      .where(eq(runs.id, id));

    if (!row) return null;

    const stepRows = await this.txHost.tx
      .select()
      .from(steps)
      .where(eq(steps.runId, id));
    const graph = await this.graphOf(row);
    const run = RunMapper.toEntity(row, stepRows, graph);
    this.remember(run);
    return run;
  }

  private async graphOf(row: RunRow): Promise<Graph> {
    if (row.graphSnapshot) return GraphMapper.toGraph(row.graphSnapshot);

    const releaseNumber = row.releaseNumber ?? 0;
    const [release] = await this.txHost.tx
      .select({ graph: releases.graph })
      .from(releases)
      .where(
        and(
          eq(releases.workflowId, row.workflowId),
          eq(releases.number, releaseNumber),
        ),
      );

    if (!release) throw new ReleaseNotFoundError();

    return GraphMapper.toGraph(release.graph);
  }

  private async saveSteps(run: Run): Promise<void> {
    const stored = this.#stored.get(run) ?? new Map<string, string>();
    const changed: StepRow[] = [];

    for (const step of run.steps) {
      const row = RunMapper.toStepRow(run.id, step);
      const text = JSON.stringify(row);
      const previous = stored.get(step.nodeId);

      if (previous !== text) changed.push(row);
    }

    if (changed.length > 0) {
      await this.txHost.tx
        .insert(steps)
        .values(changed)
        .onConflictDoUpdate({
          target: [steps.runId, steps.nodeId],
          set: {
            status: sql`excluded.status`,
            attempts: sql`excluded.attempts`,
            startedAt: sql`excluded.started_at`,
            finishedAt: sql`excluded.finished_at`,
            outputs: sql`excluded.outputs`,
            error: sql`excluded.error`,
          },
        });
    }

    this.remember(run);
  }

  private remember(run: Run): void {
    const stored = new Map<string, string>();

    for (const step of run.steps) {
      const row = RunMapper.toStepRow(run.id, step);
      const text = JSON.stringify(row);
      stored.set(step.nodeId, text);
    }

    this.#stored.set(run, stored);
  }
}
