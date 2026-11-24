import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { EventOrigin } from "../events/enums.js";
import { EventAnnouncements, EventStore } from "../events/ports.js";
import { Missing } from "../enums.js";
import type { ReceiveWebhookCallCommand, WebhookResult } from "./interfaces.js";
import { WebhookRepository } from "./ports.js";

@Injectable()
export class ReceiveWebhookCall {
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly events: EventStore,
    private readonly announcements: EventAnnouncements,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ReceiveWebhookCallCommand): Promise<WebhookResult> {
    const now = new Date();
    const webhook = await this.webhooks.findByToken(command.token);

    if (webhook === null) return { ok: false, failure: Missing.Webhook };

    const event = webhook.receive(command.call, now);
    await this.unitOfWork.run(async () => {
      const accepted = await this.events.acceptWebhookEvent(event);
      await this.announcements.announce(accepted, EventOrigin.Webhook);
    });
    return { ok: true, value: undefined };
  }
}
