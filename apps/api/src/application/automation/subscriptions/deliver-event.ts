import { Injectable } from '@nestjs/common';
import { EventStore } from '../events/ports.js';
import { Clock } from '../ports.js';
import { SecretQueries } from '../secrets/queries.js';
import {
  type AttemptResult,
  type DeliveryCommand,
  DeliveryLog,
  EventSender,
  SubscriptionRepository,
} from './ports.js';

// One attempt of a delivery: the same event, with the same id, every time (US6 AS5). A
// subscription deleted meanwhile takes nothing more.
@Injectable()
export class DeliverEvent {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: EventStore,
    private readonly secrets: SecretQueries,
    private readonly sender: EventSender,
    private readonly log: DeliveryLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: DeliveryCommand): Promise<AttemptResult> {
    const now = this.clock.now();
    const subscription = await this.subscriptions.findById(
      command.subscriptionId,
    );

    if (subscription === null) return { ok: true, value: false };

    const event = await this.events.find(command.sequence);

    if (event === null) return { ok: true, value: false };

    const endpoint = subscription.endpoint;
    const secret = endpoint.secret;
    const credential = await this.secrets.valueOf(subscription.ownerId, secret);

    if (secret !== null && credential === null) {
      const missing = `The secret '${secret}' is not available`;
      await this.log.attempted(command, missing, now);
      return { ok: false, failure: missing };
    }

    const error = await this.sender.send(endpoint, credential, event);
    await this.log.attempted(command, error, now);

    if (error !== null) return { ok: false, failure: error };

    return { ok: true, value: true };
  }
}
