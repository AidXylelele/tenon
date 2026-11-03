import { Injectable } from '@nestjs/common';
import type {
  AcceptedEvent,
  EventDeliveries,
  Listener,
} from '../../../application/automation/events/ports.js';
import { RunClient } from '../interfaces.js';

@Injectable()
export class EventDeliveriesGateway implements EventDeliveries {
  constructor(private readonly client: RunClient) {}

  // The engine keeps one signal per id, so the event's sequence and the listener's key make a
  // repeated dispatch deliver it once to each listener.
  deliver(listener: Listener, event: AcceptedEvent): Promise<void> {
    const signalId = `${String(event.sequence)}:${listener.key}`;
    return this.client.deliver(listener.key, event.cloudEvent, signalId);
  }
}
