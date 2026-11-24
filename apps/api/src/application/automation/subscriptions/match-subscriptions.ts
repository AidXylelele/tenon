import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { EventStore } from "../events/ports.js";
import type { MatchSubscriptionsCommand } from "./interfaces.js";
import {
  Deliveries,
  DeliveryLog,
  SubscriptionFilters,
  SubscriptionRepository,
} from "./ports.js";

@Injectable()
export class MatchSubscriptions {
  constructor(
    private readonly events: EventStore,
    private readonly subscriptions: SubscriptionRepository,
    private readonly filters: SubscriptionFilters,
    private readonly deliveries: Deliveries,
    private readonly log: DeliveryLog,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: MatchSubscriptionsCommand): Promise<void> {
    const now = new Date();
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const candidates = await this.subscriptions.existingAt(event.acceptedAt);
    const accepting = await this.filters.matching(
      candidates,
      event,
      command.signal,
    );

    if (accepting.length === 0) return;

    await this.unitOfWork.run(async () => {
      for (const subscription of accepting) {
        const pending = await this.log.pending(subscription, event, now);

        if (!pending) continue;

        await this.deliveries.schedule(subscription, event);
      }
    });
  }
}
