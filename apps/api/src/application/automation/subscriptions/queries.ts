import type { JsonObject } from '../../../domain/automation/json.js';
import type { DeliveryEndpoint } from '../../../domain/automation/subscriptions/interfaces.js';
import type { DeliveryStatus } from './enums.js';

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

export abstract class SubscriptionQueries {
  abstract list(ownerId: string): Promise<SubscriptionView[]>;
  // The owner's subscription with its most recent deliveries, or null.
  abstract get(ownerId: string, id: string): Promise<SubscriptionDetail | null>;
}
