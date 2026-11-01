import type { CloudEvent } from '../language/cloud-event.js';
import type { JsonObject, JsonValue } from '../language/interfaces.js';
import type { EventOriginKind } from './enums.js';

export interface EventOrigin {
  readonly kind: EventOriginKind;
  readonly workflowId: string;
  readonly instanceId: string;
}

export interface EventProps {
  readonly id: string;
  readonly source: string;
  readonly eventId: string;
  readonly type: string;
  readonly time: Date;
  readonly subject: string | null;
  readonly dataContentType: string | null;
  readonly dataSchema: string | null;
  readonly data: JsonValue;
  readonly extensions: JsonObject;
  readonly origin: EventOrigin;
  readonly sequence: number;
  readonly acceptedAt: Date;
}

export interface ProducedEvent {
  readonly cloudEvent: CloudEvent;
  readonly origin: EventOrigin;
  readonly sequence: number;
  readonly now: Date;
}
