import type {
  ProgramReference,
  RoutingMatch,
} from "../../../domain/automation/instances/interfaces.js";
import type { WebhookEvent } from "../../../domain/automation/webhooks/interfaces.js";
import type { EventOrigin } from "./enums.js";
import type { AcceptedEvent, CloudEvent } from "./interfaces.js";

export abstract class EventStore {
  abstract accept(
    cloudEvent: CloudEvent,
    origin: EventOrigin,
    instanceId: string | null,
    acceptedAt: Date,
  ): Promise<number | null>;
  abstract acceptWebhookEvent(event: WebhookEvent): Promise<number | null>;
  abstract find(sequence: number): Promise<AcceptedEvent | null>;
}

export abstract class EventRouting {
  abstract accepting(
    programs: readonly ProgramReference[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<readonly RoutingMatch[]>;
}

export abstract class EventOffers {
  abstract programsFor(event: AcceptedEvent): Promise<ProgramReference[]>;
  abstract offer(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<void>;
  abstract trigger(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<void>;
}
