import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Webhook } from "../../../domain/automation/webhooks/webhook.js";
import { WebhookToken } from "../../../domain/automation/webhooks/webhook-token.js";
import type { CreatedWebhook, CreateWebhookCommand } from "./interfaces.js";
import { WebhookRepository } from "./ports.js";

@Injectable()
export class CreateWebhook {
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: CreateWebhookCommand): Promise<CreatedWebhook> {
    const now = new Date();
    const token = WebhookToken.generate();
    const webhook = Webhook.create({
      name: command.name,
      eventType: command.eventType,
      token,
      now,
    });
    await this.unitOfWork.run(() => this.webhooks.add(webhook));
    return {
      id: webhook.id,
      name: webhook.name,
      eventType: webhook.eventType,
      createdAt: webhook.createdAt,
      token: token.value,
    };
  }
}
