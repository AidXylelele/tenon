import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { DomainEventTopic } from '../../interface-adapters/enums.js';
import type { WorkflowDetachedPayload } from '../../interface-adapters/interfaces.js';
import { WorkflowDetachedController } from '../../interface-adapters/messaging/workflow-detached.controller.js';
import { OutboxErrors } from './outbox-errors.js';

@Injectable()
export class WorkflowDetachedOutboxHandler {
  constructor(
    private readonly controller: WorkflowDetachedController,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(DomainEventTopic.WorkflowDetached, { consumer: 'instances' })
  async handle(payload: WorkflowDetachedPayload): Promise<void> {
    await this.errors.handled(() => this.controller.handle(payload));
  }
}
