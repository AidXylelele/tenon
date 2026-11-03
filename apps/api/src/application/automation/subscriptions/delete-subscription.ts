import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import {
  type SubscriptionCommand,
  SubscriptionRepository,
  type SubscriptionResult,
} from './ports.js';

// Nothing more is delivered to a deleted subscription, and its pending deliveries stop at
// their next attempt (US6 AS7).
@Injectable()
export class DeleteSubscription {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  @Transactional()
  async execute(command: SubscriptionCommand): Promise<SubscriptionResult> {
    const subscription = await this.subscriptions.findOwned(
      command.ownerId,
      command.subscriptionId,
    );

    if (subscription === null)
      return { ok: false, failure: Missing.Subscription };

    await this.subscriptions.remove(subscription);
    return { ok: true, value: undefined };
  }
}
