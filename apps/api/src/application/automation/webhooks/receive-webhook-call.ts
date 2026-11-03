import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventStore } from '../events/ports.js';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  type ReceiveWebhookCallCommand,
  type WebhookResult,
  WebhookRepository,
} from './ports.js';

// A call to a webhook's URL is accepted as one event and answered without waiting for any
// workflow (US5); a repeated call with the same key is the same event, accepted once.
@Injectable()
export class ReceiveWebhookCall {
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly events: EventStore,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: ReceiveWebhookCallCommand): Promise<WebhookResult> {
    const now = this.clock.now();
    const webhook = await this.webhooks.findByToken(command.token);

    if (webhook === null) return { ok: false, failure: Missing.Webhook };

    const event = webhook.receive(command.call, now);
    await this.events.acceptWebhookEvent(event);
    return { ok: true, value: undefined };
  }
}
