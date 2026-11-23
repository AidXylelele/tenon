import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { DeliverEvent } from "../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../application/automation/subscriptions/fail-delivery.js";
import type { DeliveryCommand } from "../../application/automation/subscriptions/interfaces.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import type { DeliveryMessage } from "./interfaces.js";

@Injectable()
export class DeliveryHandler {
  static readonly ATTEMPTS = 36;

  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly deliverEvent: DeliverEvent,
    private readonly failDelivery: FailDelivery,
  ) {}

  @OnOutboxMessage(MessageTopic.DeliveryRequested, { consumer: "deliveries" })
  async requested(
    message: DeliveryMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      subscriptionId: message.subscriptionId,
      sequence: message.sequence,
    };

    try {
      await this.span.around(context, () => this.#delivered(command));
    } catch (error) {
      const exhausted = context.attempt >= DeliveryHandler.ATTEMPTS;

      if (!exhausted) throw error;

      await this.failDelivery.execute(command);
    }

    this.outbox.notify();
  }

  async #delivered(command: DeliveryCommand): Promise<void> {
    const attempted = await this.deliverEvent.execute(command);

    if (!attempted.ok) throw new Error(attempted.failure);
  }
}
