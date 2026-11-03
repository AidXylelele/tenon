import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { AcceptedEvent } from '../../../application/automation/events/ports.js';
import { DeliveryStatus } from '../../../application/automation/subscriptions/enums.js';
import type {
  DeliveryCommand,
  DeliveryLog,
} from '../../../application/automation/subscriptions/ports.js';
import type { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import type { DrizzleTx } from '../interfaces.js';
import { delivery as deliveries } from '../schema/index.js';

// One row per delivery: pending when scheduled, counting its attempts, delivered or failed at
// its end. A delivered one stays delivered whatever a late attempt reports.
@Injectable()
export class DrizzleDeliveryLog implements DeliveryLog {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async pending(
    subscription: Subscription,
    event: AcceptedEvent,
  ): Promise<void> {
    const createdAt = new Date();
    await this.txHost.tx
      .insert(deliveries)
      .values({
        subscriptionId: subscription.id,
        sequence: event.sequence,
        eventId: event.cloudEvent.id as string,
        type: event.cloudEvent.type as string,
        status: DeliveryStatus.Pending,
        createdAt,
      })
      .onConflictDoNothing();
  }

  async attempted(
    command: DeliveryCommand,
    error: string | null,
    at: Date,
  ): Promise<void> {
    const status =
      error === null ? DeliveryStatus.Delivered : DeliveryStatus.Pending;
    await this.txHost.tx
      .update(deliveries)
      .set({
        status,
        attempts: sql`${deliveries.attempts} + 1`,
        lastError: error,
        firstAttemptAt: sql`coalesce(${deliveries.firstAttemptAt}, ${at})`,
        lastAttemptAt: at,
      })
      .where(
        and(this.#of(command), ne(deliveries.status, DeliveryStatus.Delivered)),
      );
  }

  async failed(command: DeliveryCommand, at: Date): Promise<void> {
    await this.txHost.tx
      .update(deliveries)
      .set({ status: DeliveryStatus.Failed, lastAttemptAt: at })
      .where(
        and(this.#of(command), ne(deliveries.status, DeliveryStatus.Delivered)),
      );
  }

  #of(command: DeliveryCommand) {
    return and(
      eq(deliveries.subscriptionId, command.subscriptionId),
      eq(deliveries.sequence, command.sequence),
    );
  }
}
