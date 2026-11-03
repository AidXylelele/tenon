import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { OnOutboxMessage, type OutboxHandlerContext } from '@nestjs/outbox';
import { SubscriptionController } from '../../interface-adapters/messaging/subscription.controller.js';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import { DrizzleEventStore } from '../../interface-adapters/persistence/stores/drizzle-event.store.js';
import type { AcceptedEventMessage } from '../../interface-adapters/messaging/interfaces.js';
import { OutboxErrors } from './outbox-errors.js';

// An accepted event schedules its deliveries in one transaction with this consumer's inbox, so
// a redelivered event schedules none again; the deliveries themselves run as engine runs.
@Injectable()
export class SubscriptionOutboxHandler {
  constructor(
    private readonly controller: SubscriptionController,
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(DrizzleEventStore.TOPIC, { consumer: 'subscriptions' })
  async accepted(
    message: AcceptedEventMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    await this.errors.handled(() =>
      this.txHost.withTransaction(async () => {
        await context.processInTransaction(this.txHost.tx, () =>
          this.controller.accepted(message),
        );
      }),
    );
  }
}
