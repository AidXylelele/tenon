import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import { Clock } from '../ports.js';
import { SecretQueries } from '../secrets/queries.js';
import {
  type CreateSubscriptionCommand,
  type CreateSubscriptionResult,
  SubscriptionFilters,
  SubscriptionRepository,
} from './ports.js';

// A subscription whose filter compiles; the subscription decides which secret it may use.
@Injectable()
export class CreateSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly filters: SubscriptionFilters,
    private readonly secrets: SecretQueries,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(
    command: CreateSubscriptionCommand,
  ): Promise<CreateSubscriptionResult> {
    const now = this.clock.now();
    const problem = await this.filters.problemOf(command.filter);

    if (problem !== null) return { ok: false, failure: problem };

    const owned = await this.secrets.namesOf(command.ownerId);
    const types = this.filters.typesOf(command.filter);
    const created = Subscription.create({
      ownerId: command.ownerId,
      name: command.name,
      endpoint: command.endpoint,
      filter: command.filter,
      types,
      ownedSecrets: owned,
      now,
    });

    if (!created.ok) return created;

    const subscription = created.value;
    await this.subscriptions.add(subscription);
    return { ok: true, value: subscription };
  }
}
