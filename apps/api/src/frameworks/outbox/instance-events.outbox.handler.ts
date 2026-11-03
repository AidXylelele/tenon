import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { InstanceEventKind } from '../../domain/automation/instances/enums.js';
import { RunClient } from '../../interface-adapters/workflows/interfaces.js';
import { OutboxErrors } from './outbox-errors.js';

interface InstanceMessage {
  readonly instanceId: string;
}

// What the engine learns of an instance after its commit: a cancel stops the run, a resume
// releases a held one, a delete forgets its journal.
@Injectable()
export class InstanceEventsOutboxHandler {
  constructor(
    private readonly runs: RunClient,
    private readonly errors: OutboxErrors,
  ) {}

  @OnOutboxMessage(InstanceEventKind.Cancelled, { consumer: 'engine' })
  async cancelled(message: InstanceMessage): Promise<void> {
    await this.errors.handled(() => this.runs.cancel(message.instanceId));
  }

  @OnOutboxMessage(InstanceEventKind.Resumed, { consumer: 'engine' })
  async resumed(message: InstanceMessage): Promise<void> {
    await this.errors.handled(() => this.runs.resume(message.instanceId));
  }

  @OnOutboxMessage(InstanceEventKind.Deleted, { consumer: 'engine' })
  async deleted(message: InstanceMessage): Promise<void> {
    await this.errors.handled(() => this.runs.delete(message.instanceId));
  }
}
