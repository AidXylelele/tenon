import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Webhook } from '../../../domain/automation/webhooks/webhook.js';
import { WebhookToken } from '../../../domain/automation/webhooks/webhook-token.js';
import { Clock } from '../ports.js';
import {
  type CreatedWebhook,
  type CreateWebhookCommand,
  WebhookRepository,
} from './ports.js';

@Injectable()
export class CreateWebhook {
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: CreateWebhookCommand): Promise<CreatedWebhook> {
    const now = this.clock.now();
    const token = WebhookToken.generate();
    const webhook = Webhook.create({
      name: command.name,
      eventType: command.eventType,
      token,
      now,
    });
    await this.webhooks.add(webhook);
    return { webhook, token };
  }
}
