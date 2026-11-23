import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { EventOrigin } from "./enums.js";

export type CloudEvent = JsonObject;

export interface AcceptedEvent {
  readonly sequence: number;
  readonly eventId: string;
  readonly type: string;
  readonly cloudEvent: CloudEvent;
  readonly acceptedAt: Date;
  readonly lifecycleOf: string | null;
}

export interface AcceptEventCommand {
  readonly cloudEvent: CloudEvent;
  readonly origin: EventOrigin;
  readonly instanceId: string | null;
}

export interface DispatchEventCommand {
  readonly sequence: number;
  readonly signal: AbortSignal;
}

export interface EventPage {
  readonly items: readonly JsonObject[];
  readonly next: number | null;
}
