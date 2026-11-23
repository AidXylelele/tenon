import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from "@nestjs/workflows";
import { StartScheduledInstance } from "../../../application/automation/schedules/start-scheduled-instance.js";
import type { ScheduleRunInput } from "./interfaces.js";

@Workflow("schedule")
export class ScheduleRun implements WorkflowRunner<ScheduleRunInput, void> {
  private static readonly STEP = "start";

  constructor(
    private readonly startScheduledInstance: StartScheduledInstance,
  ) {}

  async run(ctx: WorkflowContext, input: ScheduleRunInput): Promise<void> {
    if (input.delayMs > 0) await ctx.sleep("after", input.delayMs);

    const instanceId = ctx.uuid();
    const start = {
      workflowId: input.workflowId,
      instanceId,
      chained: input.chained,
    };
    await ctx.step(ScheduleRun.STEP, () =>
      this.startScheduledInstance.execute(start),
    );
  }
}
