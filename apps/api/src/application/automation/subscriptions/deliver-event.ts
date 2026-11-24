import { Injectable } from "@nestjs/common";
import { EventStore } from "../events/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import type { AttemptResult, DeliveryCommand } from "./interfaces.js";
import { DeliveryLog, EventSender, SubscriptionRepository } from "./ports.js";

@Injectable()
export class DeliverEvent {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: EventStore,
    private readonly secrets: SecretRepository,
    private readonly sender: EventSender,
    private readonly log: DeliveryLog,
  ) {}

  async execute(command: DeliveryCommand): Promise<AttemptResult> {
    const now = new Date();
    const subscription = await this.subscriptions.findById(
      command.subscriptionId,
    );

    if (subscription === null) return { ok: true, value: undefined };

    const event = await this.events.find(command.sequence);

    if (event === null) return { ok: true, value: undefined };

    const endpoint = subscription.endpoint;
    const named = endpoint.secret ?? "";
    const secret = await this.secrets.find(subscription.ownerId, named);

    if (endpoint.secret !== null && secret === null) {
      const missing = `The secret '${named}' is not available`;
      await this.log.refused(subscription, event, missing, now);
      return { ok: false, failure: missing };
    }

    const error = await this.sender.send(subscription, secret, event);

    if (error !== null) {
      await this.log.refused(subscription, event, error, now);
      return { ok: false, failure: error };
    }

    await this.log.delivered(subscription, event, now);
    return { ok: true, value: undefined };
  }
}
