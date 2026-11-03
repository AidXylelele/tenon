import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import {
  type DeleteWebhookCommand,
  type WebhookResult,
  WebhookRepository,
} from './ports.js';

// A deleted webhook's URL stops working at once; the events it gave stay.
@Injectable()
export class DeleteWebhook {
  constructor(private readonly webhooks: WebhookRepository) {}

  @Transactional()
  async execute(command: DeleteWebhookCommand): Promise<WebhookResult> {
    const webhook = await this.webhooks.findById(command.webhookId);

    if (webhook === null) return { ok: false, failure: Missing.Webhook };

    await this.webhooks.remove(webhook);
    return { ok: true, value: undefined };
  }
}
