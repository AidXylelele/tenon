import type {
  ProgramReference,
  RoutingMatch,
} from "../../../domain/automation/instances/interfaces.js";
import type { WebhookEvent } from "../../../domain/automation/webhooks/interfaces.js";
import type { EventOrigin } from "./enums.js";
import type { AcceptedEvent, CloudEvent, InstanceOffer } from "./interfaces.js";

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

export abstract class EventAnnouncements {
  abstract announce(
    sequence: number,
    origin: EventOrigin,
    cloudEvent: CloudEvent,
  ): Promise<void>;
}

export abstract class EventListeners {
  abstract programsFor(event: AcceptedEvent): Promise<ProgramReference[]>;
  abstract instancesFor(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<InstanceOffer[]>;
  abstract workflowsFor(matches: readonly RoutingMatch[]): Promise<string[]>;
}

export abstract class EventOffers {
  abstract offer(
    offers: readonly InstanceOffer[],
    event: AcceptedEvent,
  ): Promise<void>;
  abstract trigger(
    workflowIds: readonly string[],
    event: AcceptedEvent,
  ): Promise<void>;
}
