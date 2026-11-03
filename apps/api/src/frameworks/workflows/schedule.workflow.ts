import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { ScheduleRunController } from '../../interface-adapters/workflows/schedules/schedule-run.controller.js';

export interface ScheduleRunInput {
  readonly workflowId: string;
  // The `after` delay a chain's link waits before it starts its instance; 0 for the others.
  readonly delayMs: number;
  readonly chained: boolean;
}

// An occurrence of a workflow's schedule: the engine starts one per cron or interval occurrence
// across all workers, and one per link of an `after` chain. Its journaled id names the instance,
// so a step retried after a crash finds the instance it started.
@Workflow('schedule')
export class ScheduleWorkflow implements WorkflowRunner<
  ScheduleRunInput,
  void
> {
  constructor(private readonly controller: ScheduleRunController) {}

  async run(ctx: WorkflowContext, input: ScheduleRunInput): Promise<void> {
    if (input.delayMs > 0) await ctx.sleep('after', input.delayMs);

    const instanceId = ctx.uuid();
    await ctx.step('start', () =>
      this.controller.startScheduled(
        input.workflowId,
        instanceId,
        input.chained,
      ),
    );
  }
}
