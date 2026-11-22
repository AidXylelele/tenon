import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Missing } from "../enums.js";
import type { SubscriptionCommand, SubscriptionResult } from "./interfaces.js";
import { SubscriptionRepository } from "./ports.js";

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
