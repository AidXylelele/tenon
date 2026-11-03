import { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import type { SubscriptionRow } from '../interfaces.js';

export class SubscriptionMapper {
  static toRow(subscription: Subscription): SubscriptionRow {
    return {
      id: subscription.id,
      ownerId: subscription.ownerId,
      name: subscription.name,
      endpoint: subscription.endpoint,
      filter: subscription.filter,
      types: subscription.types?.slice() ?? null,
      createdAt: subscription.createdAt,
    };
  }

  static toEntity(row: SubscriptionRow): Subscription {
    return new Subscription({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      endpoint: row.endpoint,
      filter: row.filter,
      types: row.types,
      createdAt: row.createdAt,
    });
  }
}
