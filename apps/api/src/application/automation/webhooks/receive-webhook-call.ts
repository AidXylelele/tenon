import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { EventStore } from "../events/ports.js";
import { Missing } from "../enums.js";
import type { ReceiveWebhookCallCommand, WebhookResult } from "./interfaces.js";
import { WebhookRepository } from "./ports.js";

@Injectable()
export class ReceiveWebhookCall {
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly events: EventStore,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ReceiveWebhookCallCommand): Promise<WebhookResult> {
    const now = new Date();
    const webhook = await this.webhooks.findByToken(command.token);

    if (webhook === null) return { ok: false, failure: Missing.Webhook };

    const event = webhook.receive(command.call, now);
    await this.unitOfWork.run(() => this.events.acceptWebhookEvent(event));
    return { ok: true, value: undefined };
  }
}
