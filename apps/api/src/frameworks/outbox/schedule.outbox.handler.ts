import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { OnOutboxMessage, type OutboxHandlerContext } from '@nestjs/outbox';
import { WorkflowEventKind } from '../../domain/automation/workflows/enums.js';
import type { AcceptedEventMessage } from '../../interface-adapters/messaging/event-dispatch.controller.js';
import {
  ScheduleController,
  type ScheduleChangedMessage,
} from '../../interface-adapters/messaging/schedule.controller.js';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import { DrizzleEventStore } from '../../interface-adapters/persistence/stores/drizzle-event.store.js';
import { OutboxErrors } from './outbox-errors.js';

// A changed schedule reaches the engine after its commit. An accepted event starts the
// instances of the schedules it satisfies in one transaction with this consumer's inbox, so a
// redelivered event starts none again.
@Injectable()
export class ScheduleOutboxHandler {
  constructor(
    private readonly controller: ScheduleController,
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(WorkflowEventKind.ScheduleChanged, { consumer: 'schedules' })
  async changed(message: ScheduleChangedMessage): Promise<void> {
    await this.errors.handled(() => this.controller.changed(message));
  }

  @OnOutboxMessage(DrizzleEventStore.TOPIC, { consumer: 'schedule-on' })
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
