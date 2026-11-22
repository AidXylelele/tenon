import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { EventStore } from "../events/ports.js";
import type { DeliveryCommand } from "./interfaces.js";
import { DeliveryLog, SubscriptionRepository } from "./ports.js";

@Injectable()
export class FailDelivery {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: EventStore,
    private readonly log: DeliveryLog,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeliveryCommand): Promise<void> {
    const now = new Date();
    const subscription = await this.subscriptions.findById(
      command.subscriptionId,
    );
    const event = await this.events.find(command.sequence);

    if (subscription === null || event === null) return;

    await this.unitOfWork.run(() => this.log.failed(subscription, event, now));
  }
}
