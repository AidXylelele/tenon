import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { WorkflowClient, WorkflowSchedules } from '@nestjs/workflows';
import { TimingKind } from '../../interface-adapters/workflows/enums.js';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import type {
  ScheduleClient,
  ScheduleTiming,
} from '../../interface-adapters/workflows/interfaces.js';
import {
  type ScheduleRunInput,
  ScheduleWorkflow,
} from './schedule.workflow.js';

// A schedule's timing as the engine runs it: a cron (in UTC) and an interval are engine
// schedules, which start each occurrence once across all workers and, after downtime, at most
// one missed occurrence (FR-029); `after` is a chain of delayed links.
@Injectable()
export class EngineScheduleClient implements ScheduleClient {
  private static readonly UTC = 'UTC';

  constructor(
    private readonly schedules: WorkflowSchedules,
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {}

  async apply(
    workflowId: string,
    revision: number,
    timing: ScheduleTiming | null,
  ): Promise<void> {
    const id = EngineScheduleClient.idOf(workflowId);
    const input: ScheduleRunInput = { workflowId, delayMs: 0, chained: false };
    // `every` repeats from the epoch whatever the time zone, so only a cron takes one.
    const shared = {
      workflow: ScheduleWorkflow,
      missed: 'once' as const,
      overlap: 'allow' as const,
      input,
    };

    if (timing?.kind === TimingKind.Cron) {
      const tz = EngineScheduleClient.UTC;
      await this.schedules.upsert(id, { ...shared, cron: timing.cron, tz });
      return;
    }

    if (timing?.kind === TimingKind.Every) {
      await this.schedules.upsert(id, { ...shared, every: timing.everyMs });
      return;
    }

    await this.schedules.remove(id);

    if (timing?.kind !== TimingKind.After) return;

    // The first link starts at once; each turn-on starts its own chain.
    const first: ScheduleRunInput = { workflowId, delayMs: 0, chained: true };
    const firstId = `after-${workflowId}-${String(revision)}`;
    await this.client.start(ScheduleWorkflow, first, { id: firstId });
  }

  async clear(workflowId: string): Promise<void> {
    const id = EngineScheduleClient.idOf(workflowId);
    await this.schedules.remove(id);
  }

  @Transactional(Propagation.Mandatory)
  async continueAfter(
    workflowId: string,
    previousId: string,
    timing: ScheduleTiming | null,
  ): Promise<void> {
    if (timing?.kind !== TimingKind.After) return;

    const next: ScheduleRunInput = {
      workflowId,
      delayMs: timing.afterMs,
      chained: true,
    };
    await this.client.start(ScheduleWorkflow, next, {
      id: `after-${previousId}`,
      transaction: this.txHost.tx,
    });
  }

  private static idOf(workflowId: string): string {
    return `schedule-${workflowId}`;
  }
}
