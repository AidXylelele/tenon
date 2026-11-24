import type { SubscriptionDetail, SubscriptionView } from "./interfaces.js";

export abstract class SubscriptionQueries {
  abstract list(ownerId: string): Promise<SubscriptionView[]>;
  abstract get(ownerId: string, id: string): Promise<SubscriptionDetail | null>;
}
