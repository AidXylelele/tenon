import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { SubscriptionRefusal } from "../../../domain/automation/subscriptions/enums.js";
import type { DeliveryEndpoint } from "../../../domain/automation/subscriptions/interfaces.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";
import type { DefinitionProblem } from "../workflows/interfaces.js";
import type { DeliveryStatus, EndpointRefusal } from "./enums.js";

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

export interface MatchSubscriptionsCommand {
  readonly sequence: number;
  readonly signal: AbortSignal;
}

export interface DeliveryCommand {
  readonly subscriptionId: string;
  readonly sequence: number;
}

export type CreateSubscriptionResult = Result<
  SubscriptionView,
  readonly DefinitionProblem[] | SubscriptionRefusal | EndpointRefusal
>;

export type SubscriptionResult = Result<void, Missing>;

export type AttemptResult = Result<void, string>;

export interface SubscriptionView {
  readonly id: string;
  readonly name: string;
  readonly endpoint: DeliveryEndpoint;
  readonly filter: JsonObject;
  readonly createdAt: Date;
}

export interface DeliveryView {
  readonly eventId: string;
  readonly type: string;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly firstAttemptAt: Date | null;
  readonly lastAttemptAt: Date | null;
}

export interface SubscriptionDetail extends SubscriptionView {
  readonly deliveries: readonly DeliveryView[];
}
