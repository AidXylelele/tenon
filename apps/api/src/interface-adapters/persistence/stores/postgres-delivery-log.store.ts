import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, ne, sql } from "drizzle-orm";
import type { AcceptedEvent } from "../../../application/automation/events/interfaces.js";
import { DeliveryStatus } from "../../../application/automation/subscriptions/enums.js";
import type { DeliveryLog } from "../../../application/automation/subscriptions/ports.js";
import type { Subscription } from "../../../domain/automation/subscriptions/subscription.js";
import type { Transaction } from "../interfaces.js";
import { delivery as deliveries } from "../schema/index.js";

@Injectable()
export class PostgresDeliveryLogStore implements DeliveryLog {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  async pending(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void> {
    await this.txHost.tx
      .insert(deliveries)
      .values({
        subscriptionId: subscription.id,
        sequence: event.sequence,
        eventId: event.cloudEvent.id as string,
        type: event.type,
        status: DeliveryStatus.Pending,
        createdAt: at,
      })
      .onConflictDoNothing();
  }

  async delivered(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void> {
    await this.#attempted(
      subscription,
      event,
      DeliveryStatus.Delivered,
      null,
      at,
    );
  }

  async refused(
    subscription: Subscription,
    event: AcceptedEvent,
    error: string,
    at: Date,
  ): Promise<void> {
    await this.#attempted(
      subscription,
      event,
      DeliveryStatus.Pending,
      error,
      at,
    );
  }

  async failed(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void> {
    const open = this.#open(subscription, event);
    await this.txHost.tx
      .update(deliveries)
      .set({ status: DeliveryStatus.Failed, lastAttemptAt: at })
      .where(open);
  }

  async #attempted(
    subscription: Subscription,
    event: AcceptedEvent,
    status: DeliveryStatus,
    error: string | null,
    at: Date,
  ): Promise<void> {
    const open = this.#open(subscription, event);
    await this.txHost.tx
      .update(deliveries)
      .set({
        status,
        attempts: sql`${deliveries.attempts} + 1`,
        lastError: error,
        firstAttemptAt: sql`coalesce(${deliveries.firstAttemptAt}, ${at})`,
        lastAttemptAt: at,
      })
      .where(open);
  }

  #open(subscription: Subscription, event: AcceptedEvent) {
    return and(
      eq(deliveries.subscriptionId, subscription.id),
      eq(deliveries.sequence, event.sequence),
      ne(deliveries.status, DeliveryStatus.Delivered),
    );
  }
}
