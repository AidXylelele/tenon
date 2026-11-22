import {
  StepFailedError,
  Workflow,
  type WorkflowContext,
  type WorkflowRetryOptions,
  type WorkflowRunner,
} from "@nestjs/workflows";
import { DeliverEvent } from "../../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../../application/automation/subscriptions/fail-delivery.js";
import { DeliveryFailed } from "./delivery-failed.error.js";
import type { DeliveryRunInput } from "./interfaces.js";
import { RunTracer } from "./run.tracer.js";

@Workflow("delivery", {
  concurrency: [
    { limit: 4 },
    {
      limit: 1,
      key: (input: DeliveryRunInput) => input.subscriptionId,
    },
  ],
})
export class DeliveryRun implements WorkflowRunner<DeliveryRunInput, void> {
  private static readonly RETRY: WorkflowRetryOptions = {
    attempts: 36,
    backoff: { delay: "1s", factor: 2, maxDelay: "1h" },
  };
  private static readonly DELIVER = "deliver";
  private static readonly FAILED = "failed";

  constructor(
    private readonly deliverEvent: DeliverEvent,
    private readonly failDelivery: FailDelivery,
    private readonly tracer: RunTracer,
  ) {}

  run(ctx: WorkflowContext, input: DeliveryRunInput): Promise<void> {
    return this.tracer.execution(ctx, () => this.#executed(ctx, input));
  }

  async #executed(
    ctx: WorkflowContext,
    input: DeliveryRunInput,
  ): Promise<void> {
    const retry = { retry: DeliveryRun.RETRY };

    try {
      await ctx.step(
        DeliveryRun.DELIVER,
        (attempt) =>
          this.tracer.attempt(DeliveryRun.DELIVER, attempt, () =>
            this.#delivered(input),
          ),
        retry,
      );
    } catch (error) {
      if (!(error instanceof StepFailedError)) throw error;

      await ctx.step(DeliveryRun.FAILED, (attempt) =>
        this.tracer.attempt(DeliveryRun.FAILED, attempt, () =>
          this.failDelivery.execute(input),
        ),
      );
    }
  }

  async #delivered(input: DeliveryRunInput): Promise<void> {
    const attempted = await this.deliverEvent.execute(input);

    if (!attempted.ok) throw new DeliveryFailed(attempted.failure);
  }
}
