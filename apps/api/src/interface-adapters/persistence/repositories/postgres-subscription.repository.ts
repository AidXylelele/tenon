import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, lte } from "drizzle-orm";
import type { SubscriptionRepository } from "../../../application/automation/subscriptions/ports.js";
import type { Subscription } from "../../../domain/automation/subscriptions/subscription.js";
import type { Transaction } from "../interfaces.js";
import { SubscriptionMapper } from "../mappers/subscription.mapper.js";
import { subscription as subscriptions } from "../schema/index.js";

@Injectable()
export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly subscriptionMapper: SubscriptionMapper,
  ) {}

  async findById(id: string): Promise<Subscription | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id));

    if (!row) return null;

    return this.subscriptionMapper.toEntity(row);
  }

  async findOwned(ownerId: string, id: string): Promise<Subscription | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.ownerId, ownerId)));

    if (!row) return null;

    return this.subscriptionMapper.toEntity(row);
  }

  async existingAt(acceptedAt: Date): Promise<Subscription[]> {
    const existed = lte(subscriptions.createdAt, acceptedAt);
    const rows = await this.txHost.tx
      .select()
      .from(subscriptions)
      .where(existed);
    return rows.map((row) => this.subscriptionMapper.toEntity(row));
  }

  async add(subscription: Subscription): Promise<void> {
    const row = this.subscriptionMapper.toRow(subscription);
    await this.txHost.tx.insert(subscriptions).values(row);
  }

  async remove(subscription: Subscription): Promise<void> {
    await this.txHost.tx
      .delete(subscriptions)
      .where(eq(subscriptions.id, subscription.id));
  }
}
