import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { Secret } from "../../../domain/automation/secrets/secret.js";
import type { Subscription } from "../../../domain/automation/subscriptions/subscription.js";
import type { Result } from "../../../domain/interfaces.js";
import type { AcceptedEvent } from "../events/interfaces.js";
import type { DefinitionProblem } from "../workflows/interfaces.js";

export abstract class SubscriptionRepository {
  abstract findById(id: string): Promise<Subscription | null>;
  abstract findOwned(ownerId: string, id: string): Promise<Subscription | null>;
  abstract existingAt(acceptedAt: Date): Promise<Subscription[]>;
  abstract add(subscription: Subscription): Promise<void>;
  abstract remove(subscription: Subscription): Promise<void>;
}

export abstract class SubscriptionFilters {
  abstract check(
    filter: JsonObject,
  ): Promise<Result<void, readonly DefinitionProblem[]>>;
  abstract matching(
    subscriptions: readonly Subscription[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<Subscription[]>;
}

export abstract class Deliveries {
  abstract schedule(
    subscription: Subscription,
    event: AcceptedEvent,
  ): Promise<void>;
}

export abstract class EventSender {
  abstract admits(uri: string): Promise<boolean>;
  abstract send(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null>;
}

export abstract class DeliveryLog {
  abstract pending(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void>;
  abstract delivered(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void>;
  abstract refused(
    subscription: Subscription,
    event: AcceptedEvent,
    error: string,
    at: Date,
  ): Promise<void>;
  abstract failed(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void>;
}
