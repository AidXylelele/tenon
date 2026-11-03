import type { JsonObject } from '../../../domain/automation/json.js';
import type { DeliveryEndpoint } from '../../../domain/automation/subscriptions/interfaces.js';
import type { SubscriptionRefusal } from '../../../domain/automation/subscriptions/enums.js';
import type { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import type { Result } from '../../../domain/result.js';
import type { AcceptedEvent } from '../events/ports.js';
import type { DefinitionProblem } from '../workflows/ports.js';
import type { Missing } from '../enums.js';

export interface CreateSubscriptionCommand {
  readonly ownerId: string;
  readonly name: string;
  readonly endpoint: DeliveryEndpoint;
  readonly filter: JsonObject;
}

export interface SubscriptionCommand {
  readonly ownerId: string;
  readonly subscriptionId: string;
}

export interface DeliveryCommand {
  readonly subscriptionId: string;
  readonly sequence: number;
}

export type CreateSubscriptionResult = Result<
  Subscription,
  DefinitionProblem | SubscriptionRefusal
>;

export type SubscriptionResult = Result<undefined, Missing>;

// An attempt's outcome: delivered, gone (the subscription was deleted, nothing more to do), or
// the error to retry after.
export type AttemptResult = Result<boolean, string>;

export abstract class SubscriptionRepository {
  abstract findById(id: string): Promise<Subscription | null>;
  abstract findOwned(ownerId: string, id: string): Promise<Subscription | null>;
  // The subscriptions that may take events of this type, created before it was accepted (only
  // the events accepted once a subscription exists reach it), as listeners are found.
  abstract ofType(type: string, acceptedAt: Date): Promise<Subscription[]>;
  abstract add(subscription: Subscription): Promise<void>;
  abstract remove(subscription: Subscription): Promise<void>;
}

// The standard's event filter, as the runtime reads it.
export abstract class SubscriptionFilters {
  // The filter's first problem (a pattern or an expression that does not compile), or null.
  abstract problemOf(filter: JsonObject): Promise<DefinitionProblem | null>;
  abstract typesOf(filter: JsonObject): readonly string[] | null;
  abstract accepts(filter: JsonObject, event: AcceptedEvent): Promise<boolean>;
}

// One delivery per subscription and event, retried by the engine for about 24 hours.
export abstract class Deliveries {
  // In the caller's transaction.
  abstract schedule(
    subscription: Subscription,
    event: AcceptedEvent,
  ): Promise<void>;
}

// Sends an event to an endpoint in CloudEvents' HTTP structured mode, authenticated with the
// secret's value if any; null when a 2xx answered, the error otherwise (never the credential).
// The address policy refuses private destinations (FR-022).
export abstract class EventSender {
  abstract send(
    endpoint: DeliveryEndpoint,
    credential: string | null,
    event: AcceptedEvent,
  ): Promise<string | null>;
}

// What the owner reads of each delivery (US6 AS6): pending until an attempt delivers it, with
// each attempt counted and the last error kept, or failed once its attempts are spent.
export abstract class DeliveryLog {
  abstract pending(
    subscription: Subscription,
    event: AcceptedEvent,
    at: Date,
  ): Promise<void>;
  abstract delivered(command: DeliveryCommand, at: Date): Promise<void>;
  abstract refused(
    command: DeliveryCommand,
    error: string,
    at: Date,
  ): Promise<void>;
  abstract failed(command: DeliveryCommand, at: Date): Promise<void>;
}
