import { Injectable } from '@nestjs/common';
import { EventDeliveries, EventStore, ListenerStore } from './ports.js';

export interface DispatchEventCommand {
  readonly sequence: number;
}

// An accepted event reaches, after its commit, every run that listens for its type; each run
// decides by its own filters whether it consumes it.
@Injectable()
export class DispatchEvent {
  constructor(
    private readonly events: EventStore,
    private readonly listeners: ListenerStore,
    private readonly deliveries: EventDeliveries,
  ) {}

  async execute(command: DispatchEventCommand): Promise<void> {
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const type = event.cloudEvent.type as string;
    const listening = await this.listeners.ofType(type, event.acceptedAt);

    for (const listener of listening)
      await this.deliveries.deliver(listener, event);
  }
}
