import {
  Workflow,
  WorkflowClient,
  type WorkflowContext,
  type WorkflowRunner,
  type WorkflowStatus,
} from '@nestjs/workflows';
import { Transactional } from '@nestjs-cls/transactional';
import { ListActiveWorkflows } from '../../application/use-cases/list-active-workflows.js';
import { ListStaleRuns } from '../../application/use-cases/list-stale-runs.js';
import { TerminateRun } from '../../application/use-cases/terminate-run.js';
import type { EngineEnd } from '../../application/interfaces.js';
import { ErrorKind } from '../../domain/enums.js';
import { RunWorkflow } from './run.workflow.js';
import { ScheduleRegistrar } from './schedule-registrar.js';

const ENDED: readonly WorkflowStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'compensation_failed',
];

@Workflow('automation.maintenance', {
  schedules: [
    {
      id: 'automation.maintenance',
      every: '1m',
      missed: 'skip',
      overlap: 'skip',
    },
  ],
})
export class MaintenanceWorkflow implements WorkflowRunner<unknown, void> {
  static readonly STALE_AFTER_MS = 60_000;
  static readonly STOPPED: EngineEnd = {
    kind: ErrorKind.Platform,
    message: 'The run stopped without finishing',
  };

  constructor(
    private readonly client: WorkflowClient,
    private readonly listStaleRuns: ListStaleRuns,
    private readonly terminateRun: TerminateRun,
    private readonly listActiveWorkflows: ListActiveWorkflows,
    private readonly registrar: ScheduleRegistrar,
  ) {}

  async run(ctx: WorkflowContext): Promise<void> {
    const now = ctx.now();
    const cutoff = now - MaintenanceWorkflow.STALE_AFTER_MS;
    const before = new Date(cutoff);
    const stale = await ctx.step('stale-runs', () =>
      this.listStaleRuns.execute(before),
    );

    for (const runId of stale) {
      await ctx.step(`settle:${runId}`, () => this.settle(runId));
    }

    const workflows = await ctx.step('scheduled-workflows', () =>
      this.scheduledWorkflows(),
    );

    for (const workflowId of workflows) {
      await ctx.step(`sync:${workflowId}`, () =>
        this.registrar.sync(workflowId),
      );
    }
  }

  private async scheduledWorkflows(): Promise<string[]> {
    const active = await this.listActiveWorkflows.execute();
    const registered = await this.registrar.registered();
    const scheduled = registered.keys();
    const workflowIds = new Set([...active, ...scheduled]);
    return [...workflowIds];
  }

  private async settle(runId: string): Promise<void> {
    const end = await this.endOf(runId);

    if (!end) return;

    await this.terminate(runId, end);
  }

  @Transactional()
  private terminate(runId: string, end: EngineEnd): Promise<void> {
    return this.terminateRun.execute(runId, end);
  }

  private async endOf(runId: string): Promise<EngineEnd | null> {
    const instance = await this.client.getStatus(runId);

    if (!instance) return MaintenanceWorkflow.STOPPED;

    const ended = ENDED.includes(instance.status);

    if (!ended) return null;

    if (!instance.error) return MaintenanceWorkflow.STOPPED;

    return RunWorkflow.endOf(instance.error);
  }
}
