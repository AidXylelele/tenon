import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { WorkflowClient } from "@nestjs/workflows";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { Deliveries } from "../../application/automation/subscriptions/ports.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import type { Transaction } from "../../interface-adapters/persistence/interfaces.js";
import { DeliveryRun } from "./delivery.run.js";

@Injectable()
export class EngineDeliveryClient implements Deliveries {
  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<Transaction>,
  ) {}

  @Transactional(Propagation.Mandatory)
  async schedule(
    subscription: Subscription,
    event: AcceptedEvent,
  ): Promise<void> {
    const subscriptionId = subscription.id;
    const sequence = event.sequence;
    const id = `delivery-${subscriptionId}-${String(sequence)}`;
    await this.client.start(
      DeliveryRun,
      { subscriptionId, sequence },
      { id, transaction: this.txHost.tx },
    );
  }
}
