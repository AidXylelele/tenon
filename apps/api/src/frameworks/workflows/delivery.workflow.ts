import {
  isWorkflowInterrupt,
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { DeliveryRunController } from '../../interface-adapters/workflows/subscriptions/delivery-run.controller.js';

export interface DeliveryRunInput {
  readonly subscriptionId: string;
  readonly sequence: number;
}

// One event to one subscription: attempts with growing delays (1 s doubling to an hour, 36
// attempts, about 24 hours), each parking the run durably, then failed (US6 AS3). At most four
// deliveries run at once and one per subscription, so a slow destination holds one of the
// engine's slots and delays neither workflows nor other subscriptions (US6 AS4).
@Workflow('delivery', {
  concurrency: [
    { limit: 4 },
    {
      limit: 1,
      key: (input: DeliveryRunInput) => input.subscriptionId,
    },
  ],
})
export class DeliveryWorkflow implements WorkflowRunner<
  DeliveryRunInput,
  void
> {
  private static readonly RETRY = {
    attempts: 36,
    backoff: { delay: '1s' as const, factor: 2, maxDelay: '1h' as const },
  };

  constructor(private readonly controller: DeliveryRunController) {}

  async run(ctx: WorkflowContext, input: DeliveryRunInput): Promise<void> {
    const id = input.subscriptionId;
    const sequence = input.sequence;

    try {
      await ctx.step('deliver', () => this.controller.attempt(id, sequence), {
        retry: DeliveryWorkflow.RETRY,
      });
    } catch (error) {
      if (isWorkflowInterrupt(error)) throw error;

      await ctx.step('failed', () => this.controller.failed(id, sequence));
    }
  }
}
