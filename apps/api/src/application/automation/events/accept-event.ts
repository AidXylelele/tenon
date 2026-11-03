import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { EventOrigin } from './enums.js';
import { type CloudEvent, EventStore } from './ports.js';

export interface AcceptEventCommand {
  readonly cloudEvent: CloudEvent;
  readonly origin: EventOrigin;
  readonly instanceId: string | null;
}

// An event from a user, an application, a webhook or an `emit`: accepted once per source and id
// (FR-023); a duplicate is acknowledged and has no effect.
@Injectable()
export class AcceptEvent {
  constructor(private readonly events: EventStore) {}

  @Transactional()
  async execute(command: AcceptEventCommand): Promise<boolean> {
    const sequence = await this.events.accept(
      command.cloudEvent,
      command.origin,
      command.instanceId,
    );
    return sequence !== null;
  }
}
