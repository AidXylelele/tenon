import type { JsonObject } from '../../../domain/automation/json.js';
import type { EventOrigin } from './enums.js';

// A CloudEvent 1.0 in its structured JSON form.
export type CloudEvent = JsonObject;

export interface AcceptedEvent {
  readonly sequence: number;
  readonly cloudEvent: CloudEvent;
  readonly origin: EventOrigin;
  readonly instanceId: string | null;
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
