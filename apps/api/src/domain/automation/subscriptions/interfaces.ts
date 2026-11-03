import type { JsonObject } from '../json.js';
import type { DeliveryScheme } from './enums.js';

// Where deliveries go: a URI and, optionally, the owner's secret that authenticates them.
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
  // The standard's event filter (`with`), matched as a `listen` matches it.
  readonly filter: JsonObject;
  // The types the filter takes, or null when it takes any type.
  readonly types: readonly string[] | null;
  readonly createdAt: Date;
}

// `ownedSecrets`: the names of the owner's secrets, the only ones its deliveries may use.
export interface NewSubscription {
  readonly ownerId: string;
  readonly name: string;
  readonly endpoint: DeliveryEndpoint;
  readonly filter: JsonObject;
  readonly types: readonly string[] | null;
  readonly ownedSecrets: readonly string[];
  readonly now: Date;
}
