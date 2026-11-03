import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { EventDispatchController } from '../../interface-adapters/messaging/event-dispatch.controller.js';
import { DrizzleEventStore } from '../../interface-adapters/persistence/stores/drizzle-event.store.js';
import type { AcceptedEventMessage } from '../../interface-adapters/messaging/interfaces.js';
import { OutboxErrors } from './outbox-errors.js';

@Injectable()
export class EventDispatchOutboxHandler {
  constructor(
    private readonly controller: EventDispatchController,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(DrizzleEventStore.TOPIC, { consumer: 'dispatch' })
  async dispatch(message: AcceptedEventMessage): Promise<void> {
    await this.errors.handled(() => this.controller.handle(message));
  }
}
