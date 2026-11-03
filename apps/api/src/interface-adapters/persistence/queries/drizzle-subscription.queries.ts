import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  SubscriptionDetail,
  SubscriptionQueries,
  SubscriptionView,
} from '../../../application/automation/subscriptions/queries.js';
import type { DrizzleTx } from '../interfaces.js';
import {
  delivery as deliveries,
  subscription as subscriptions,
} from '../schema/index.js';

@Injectable()
export class DrizzleSubscriptionQueries implements SubscriptionQueries {
  private static readonly RECENT = 50;

  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  list(ownerId: string): Promise<SubscriptionView[]> {
    return this.txHost.tx
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        endpoint: subscriptions.endpoint,
        filter: subscriptions.filter,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, ownerId))
      .orderBy(asc(subscriptions.name));
  }

  async get(ownerId: string, id: string): Promise<SubscriptionDetail | null> {
    const [found] = await this.txHost.tx
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        endpoint: subscriptions.endpoint,
        filter: subscriptions.filter,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.ownerId, ownerId)));

    if (!found) return null;

    const recent = await this.txHost.tx
      .select({
        eventId: deliveries.eventId,
        type: deliveries.type,
        status: deliveries.status,
        attempts: deliveries.attempts,
        lastError: deliveries.lastError,
        firstAttemptAt: deliveries.firstAttemptAt,
        lastAttemptAt: deliveries.lastAttemptAt,
      })
      .from(deliveries)
      .where(eq(deliveries.subscriptionId, id))
      .orderBy(desc(deliveries.createdAt), desc(deliveries.sequence))
      .limit(DrizzleSubscriptionQueries.RECENT);
    return {
      id: found.id,
      name: found.name,
      endpoint: found.endpoint,
      filter: found.filter,
      createdAt: found.createdAt,
      deliveries: recent,
    };
  }
}
