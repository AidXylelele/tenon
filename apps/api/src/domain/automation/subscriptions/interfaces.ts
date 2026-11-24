import type { JsonObject } from "../interfaces.js";
import type { Secret } from "../secrets/secret.js";
import type { DeliveryScheme } from "./enums.js";

export interface DeliveryEndpoint {
  readonly uri: string;
  readonly scheme: DeliveryScheme | null;
  readonly secret: string | null;
}

export interface SubscriptionProps {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly endpoint: DeliveryEndpoint;
  readonly filter: JsonObject;
  readonly createdAt: Date;
}

export interface NewSubscription {
  readonly ownerId: string;
  readonly name: string;
  readonly endpoint: DeliveryEndpoint;
  readonly filter: JsonObject;
  readonly ownedSecrets: readonly Secret[];
  readonly now: Date;
}
