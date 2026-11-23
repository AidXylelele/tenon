import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { Deliveries } from "../../application/automation/subscriptions/ports.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import type { Transaction } from "../persistence/interfaces.js";
import { MessageTopic } from "./enums.js";
import type { DeliveryMessage } from "./interfaces.js";

@Injectable()
export class DeliveryMessagesGateway implements Deliveries {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
  ) {}

  async schedule(
    subscription: Subscription,
    event: AcceptedEvent,
  ): Promise<void> {
    const payload: DeliveryMessage = {
      subscriptionId: subscription.id,
      sequence: event.sequence,
    };
    const message = {
      topic: MessageTopic.DeliveryRequested,
      key: subscription.id,
      payload,
    };
    await this.outbox.add(this.txHost.tx, message);
  }
}
