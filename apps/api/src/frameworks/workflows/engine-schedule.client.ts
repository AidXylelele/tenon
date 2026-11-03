import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { WorkflowClient, WorkflowSchedules } from '@nestjs/workflows';
import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../domain/automation/json.js';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import type { ScheduleClient } from '../../interface-adapters/workflows/interfaces.js';
import { Durations } from '../runtime/document/durations.js';
import {
  type ScheduleRunInput,
  ScheduleWorkflow,
} from './schedule.workflow.js';

// A document's `schedule` as the engine runs it: `cron` (in UTC) and `every` are engine
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
    turnedOn: number,
    document: JsonObject,
  ): Promise<void> {
    const schedule = EngineScheduleClient.scheduleOf(document);
    const id = EngineScheduleClient.idOf(workflowId);
    const input: ScheduleRunInput = { workflowId, delayMs: 0, chained: false };
    // `every` repeats from the epoch whatever the time zone, so only a cron takes one.
    const shared = {
      workflow: ScheduleWorkflow,
      missed: 'once' as const,
      overlap: 'allow' as const,
      input,
    };

    if (schedule.cron !== undefined) {
      const cron = schedule.cron;
      const tz = EngineScheduleClient.UTC;
      await this.schedules.upsert(id, { ...shared, cron, tz });
      return;
    }

    if (schedule.every !== undefined) {
      const every = Durations.millisecondsOf(schedule.every);
      await this.schedules.upsert(id, { ...shared, every });
      return;
    }

    await this.schedules.remove(id);

    if (schedule.after === undefined) return;

    // The first link starts at once; each turn-on starts its own chain.
    const first: ScheduleRunInput = { workflowId, delayMs: 0, chained: true };
    const firstId = `after-${workflowId}-${String(turnedOn)}`;
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
    document: JsonObject,
  ): Promise<void> {
    const after = EngineScheduleClient.scheduleOf(document).after;

    if (after === undefined) return;

    const delayMs = Durations.millisecondsOf(after);
    const next: ScheduleRunInput = { workflowId, delayMs, chained: true };
    await this.client.start(ScheduleWorkflow, next, {
      id: `after-${previousId}`,
      transaction: this.txHost.tx,
    });
  }

  private static scheduleOf(document: JsonObject): Specification.Schedule {
    const workflow = document as unknown as Specification.Workflow;
    return workflow.schedule ?? {};
  }

  private static idOf(workflowId: string): string {
    return `schedule-${workflowId}`;
  }
}
