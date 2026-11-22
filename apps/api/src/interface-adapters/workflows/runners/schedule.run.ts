import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from "@nestjs/workflows";
import { StartScheduledInstance } from "../../../application/automation/schedules/start-scheduled-instance.js";
import type { ScheduleRunInput } from "./interfaces.js";
import { RunTracer } from "./run.tracer.js";

@Workflow("schedule")
export class ScheduleRun implements WorkflowRunner<ScheduleRunInput, void> {
  private static readonly STEP = "start";

  constructor(
    private readonly startScheduledInstance: StartScheduledInstance,
    private readonly tracer: RunTracer,
  ) {}

  run(ctx: WorkflowContext, input: ScheduleRunInput): Promise<void> {
    return this.tracer.execution(ctx, () => this.#executed(ctx, input));
  }

  async #executed(
    ctx: WorkflowContext,
    input: ScheduleRunInput,
  ): Promise<void> {
    if (input.delayMs > 0) await ctx.sleep("after", input.delayMs);

    const instanceId = ctx.uuid();
    const start = {
      workflowId: input.workflowId,
      instanceId,
      chained: input.chained,
    };
    await ctx.step(ScheduleRun.STEP, (attempt) =>
      this.tracer.attempt(ScheduleRun.STEP, attempt, () =>
        this.startScheduledInstance.execute(start),
      ),
    );
  }
}
