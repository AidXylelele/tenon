import { Injectable } from '@nestjs/common';
import { EventStore } from '../events/ports.js';
import {
  Deliveries,
  DeliveryLog,
  SubscriptionFilters,
  SubscriptionRepository,
} from './ports.js';

export interface MatchSubscriptionsCommand {
  readonly sequence: number;
}

// An accepted event becomes one delivery for every subscription whose filter takes it and
// that existed when it was accepted (FR-026); its consumer's inbox, in the same transaction,
// keeps a redelivered event from scheduling them again.
@Injectable()
export class MatchSubscriptions {
  constructor(
    private readonly events: EventStore,
    private readonly subscriptions: SubscriptionRepository,
    private readonly filters: SubscriptionFilters,
    private readonly deliveries: Deliveries,
    private readonly log: DeliveryLog,
  ) {}

  async execute(command: MatchSubscriptionsCommand): Promise<void> {
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const type = event.cloudEvent.type as string;
    const candidates = await this.subscriptions.ofType(type);

    for (const subscription of candidates) {
      if (!subscription.takesEventsOf(event.acceptedAt)) continue;

      const accepts = await this.filters.accepts(subscription.filter, event);

      if (!accepts) continue;

      await this.log.pending(subscription, event);
      await this.deliveries.schedule(subscription, event);
    }
  }
}
