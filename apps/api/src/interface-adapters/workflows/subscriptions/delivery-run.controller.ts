import { Injectable } from '@nestjs/common';
import { DeliverEvent } from '../../../application/automation/subscriptions/deliver-event.js';
import { FailDelivery } from '../../../application/automation/subscriptions/fail-delivery.js';

// What a delivery's run asks of the platform: an attempt, which throws to be retried, and the
// end of one that was never accepted.
@Injectable()
export class DeliveryRunController {
  constructor(
    private readonly deliverEvent: DeliverEvent,
    private readonly failDelivery: FailDelivery,
  ) {}

  async attempt(subscriptionId: string, sequence: number): Promise<void> {
    const attempted = await this.deliverEvent.execute({
      subscriptionId,
      sequence,
    });

    if (!attempted.ok) throw new Error(attempted.failure);
  }

  failed(subscriptionId: string, sequence: number): Promise<void> {
    return this.failDelivery.execute({ subscriptionId, sequence });
  }
}
