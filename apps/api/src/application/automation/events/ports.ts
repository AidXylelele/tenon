import type { JsonObject } from '../../../domain/automation/json.js';
import type { EventOrigin } from './enums.js';

// A CloudEvent 1.0 in its structured JSON form.
export type CloudEvent = JsonObject;

export interface AcceptedEvent {
  readonly sequence: number;
  readonly cloudEvent: CloudEvent;
  readonly origin: EventOrigin;
  readonly instanceId: string | null;
  readonly acceptedAt: Date;
}

// The events the platform accepted, each once per source and id; an accepted one is dispatched
// after the commit to the listeners, schedules and subscriptions it matches.
export abstract class EventStore {
  // The event's sequence, or null when an event of the same source and id was accepted before.
  abstract accept(
    cloudEvent: CloudEvent,
    origin: EventOrigin,
    instanceId: string | null,
  ): Promise<number | null>;
  abstract find(sequence: number): Promise<AcceptedEvent | null>;
}

export interface Listener {
  readonly instanceId: string;
  readonly key: string;
}

// The `listen` tasks of running instances that wait now.
export abstract class ListenerStore {
  abstract add(
    instanceId: string,
    key: string,
    types: string[] | null,
  ): Promise<void>;
  abstract remove(instanceId: string, key: string): Promise<void>;
  // The listeners of running instances that take events of this type and began before it was
  // accepted (US7: an event accepted earlier does not reach a later listen).
  abstract ofType(type: string, acceptedAt: Date): Promise<readonly Listener[]>;
}

// Sends an accepted event to a listening run, once per event and listener.
export abstract class EventDeliveries {
  abstract deliver(listener: Listener, event: AcceptedEvent): Promise<void>;
}
