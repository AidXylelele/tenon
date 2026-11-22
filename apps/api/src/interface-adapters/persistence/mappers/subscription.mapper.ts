import { Injectable } from "@nestjs/common";
import { Subscription } from "../../../domain/automation/subscriptions/subscription.js";
import type { SubscriptionRow } from "../interfaces.js";

@Injectable()
export class SubscriptionMapper {
  toRow(subscription: Subscription): SubscriptionRow {
    return {
      id: subscription.id,
      ownerId: subscription.ownerId,
      name: subscription.name,
      endpoint: subscription.endpoint,
      filter: subscription.filter,
      createdAt: subscription.createdAt,
    };
  }

  toEntity(row: SubscriptionRow): Subscription {
    return new Subscription({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      endpoint: row.endpoint,
      filter: row.filter,
      createdAt: row.createdAt,
    });
  }
}
