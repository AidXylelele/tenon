import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { DomainEventTopic } from '../../interface-adapters/enums.js';
import type { ProcessDetachedPayload } from '../../interface-adapters/interfaces.js';
import { ProcessDetachedController } from '../../interface-adapters/messaging/process-detached.controller.js';
import { OutboxErrors } from './outbox-errors.js';

@Injectable()
export class ProcessDetachedOutboxHandler {
  constructor(
    private readonly controller: ProcessDetachedController,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(DomainEventTopic.ProcessDetached, { consumer: 'sandbox' })
  async handle(payload: ProcessDetachedPayload): Promise<void> {
    await this.errors.handled(() => this.controller.handle(payload));
  }
}
