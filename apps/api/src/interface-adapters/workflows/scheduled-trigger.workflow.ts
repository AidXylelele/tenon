import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { Transactional } from '@nestjs-cls/transactional';
import { StartScheduledRun } from '../../application/use-cases/start-scheduled-run.js';
import { RunWorkflow } from './run.workflow.js';

export interface ScheduledOccurrence {
  readonly workflowId: string;
  readonly releaseNumber: number;
  readonly nodeId: string;
}

export interface ScheduledRun {
  readonly runId: string;
  readonly timeoutMs: number;
}

@Workflow('automation.scheduled-trigger')
export class ScheduledTriggerWorkflow implements WorkflowRunner<
  ScheduledOccurrence,
  void
> {
  constructor(private readonly startScheduledRun: StartScheduledRun) {}

  async run(ctx: WorkflowContext, input: ScheduledOccurrence): Promise<void> {
    const { schedule } = ctx;

    if (!schedule) return;

    const at = new Date(schedule.at);
    const started = await ctx.step('start', () =>
      this.start(input, ctx.workflowId, at),
    );

    if (!started) return;

    await ctx.executeChild(
      RunWorkflow,
      { runId: started.runId, workflowId: input.workflowId },
      { id: started.runId, timeout: started.timeoutMs },
    );
  }

  @Transactional()
  private async start(
    input: ScheduledOccurrence,
    occurrence: string,
    at: Date,
  ): Promise<ScheduledRun | null> {
    const run = await this.startScheduledRun.execute({
      workflowId: input.workflowId,
      releaseNumber: input.releaseNumber,
      nodeId: input.nodeId,
      occurrence,
      at,
    });

    if (!run) return null;

    return { runId: run.id, timeoutMs: run.timeoutMs };
  }
}
