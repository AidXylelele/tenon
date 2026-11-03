import { Injectable } from '@nestjs/common';
import type { AcceptedEvent } from '../../../application/automation/events/ports.js';
import type { Deliveries } from '../../../application/automation/subscriptions/ports.js';
import type { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import { DeliveryRunClient } from '../interfaces.js';

@Injectable()
export class DeliveriesGateway implements Deliveries {
  constructor(private readonly client: DeliveryRunClient) {}

  schedule(subscription: Subscription, event: AcceptedEvent): Promise<void> {
    return this.client.start(subscription.id, event.sequence);
  }
}
