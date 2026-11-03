import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq, isNull, or, sql } from 'drizzle-orm';
import type { SubscriptionRepository } from '../../../application/automation/subscriptions/ports.js';
import type { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import type { DrizzleTx } from '../interfaces.js';
import { SubscriptionMapper } from '../mappers/subscription.mapper.js';
import { subscription as subscriptions } from '../schema/index.js';

// A subscription is written once and removed whole.
@Injectable()
export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async findById(id: string): Promise<Subscription | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id));

    if (!row) return null;

    return SubscriptionMapper.toEntity(row);
  }

  async ofType(type: string): Promise<Subscription[]> {
    const takes = or(
      isNull(subscriptions.types),
      sql`${type} = any(${subscriptions.types})`,
    );
    const rows = await this.txHost.tx.select().from(subscriptions).where(takes);
    return rows.map((row) => SubscriptionMapper.toEntity(row));
  }

  async add(subscription: Subscription): Promise<void> {
    const row = SubscriptionMapper.toRow(subscription);
    await this.txHost.tx.insert(subscriptions).values(row);
  }

  async remove(subscription: Subscription): Promise<void> {
    await this.txHost.tx
      .delete(subscriptions)
      .where(eq(subscriptions.id, subscription.id));
  }
}
