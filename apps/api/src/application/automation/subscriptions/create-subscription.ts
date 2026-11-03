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

// A subscription whose filter compiles, authenticating with a secret its owner keeps.
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

    const secret = command.endpoint.secret;

    if (secret !== null) {
      const owned = await this.secrets.namesOf(command.ownerId);

      if (!owned.includes(secret))
        return {
          ok: false,
          failure: {
            pointer: '/endpoint/authentication/secret',
            detail: `'${secret}' is not one of your secrets`,
          },
        };
    }

    const types = this.filters.typesOf(command.filter);
    const subscription = Subscription.create({
      ownerId: command.ownerId,
      name: command.name,
      endpoint: command.endpoint,
      filter: command.filter,
      types,
      now,
    });
    await this.subscriptions.add(subscription);
    return { ok: true, value: subscription };
  }
}
