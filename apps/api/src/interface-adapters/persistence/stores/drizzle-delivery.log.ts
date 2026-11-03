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

// One row per delivery, as the use cases report it. A delivered one stays as it is: the
// condition only fences an attempt that ran meanwhile.
@Injectable()
export class DrizzleDeliveryLog implements DeliveryLog {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

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

  async delivered(command: DeliveryCommand, at: Date): Promise<void> {
    await this.#attempted(command, DeliveryStatus.Delivered, null, at);
  }

  async refused(
    command: DeliveryCommand,
    error: string,
    at: Date,
  ): Promise<void> {
    await this.#attempted(command, DeliveryStatus.Pending, error, at);
  }

  async failed(command: DeliveryCommand, at: Date): Promise<void> {
    await this.txHost.tx
      .update(deliveries)
      .set({ status: DeliveryStatus.Failed, lastAttemptAt: at })
      .where(this.#open(command));
  }

  async #attempted(
    command: DeliveryCommand,
    status: DeliveryStatus,
    error: string | null,
    at: Date,
  ): Promise<void> {
    await this.txHost.tx
      .update(deliveries)
      .set({
        status,
        attempts: sql`${deliveries.attempts} + 1`,
        lastError: error,
        firstAttemptAt: sql`coalesce(${deliveries.firstAttemptAt}, ${at})`,
        lastAttemptAt: at,
      })
      .where(this.#open(command));
  }

  #open(command: DeliveryCommand) {
    return and(
      eq(deliveries.subscriptionId, command.subscriptionId),
      eq(deliveries.sequence, command.sequence),
      ne(deliveries.status, DeliveryStatus.Delivered),
    );
  }
}
