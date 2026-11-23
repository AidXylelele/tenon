import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import type { SubscriptionCommand, SubscriptionResult } from "./interfaces.js";
import { SubscriptionRepository } from "./ports.js";

@Injectable()
export class DeleteSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: SubscriptionCommand): Promise<SubscriptionResult> {
    const subscription = await this.subscriptions.findOwned(
      command.ownerId,
      command.subscriptionId,
    );

    if (subscription === null)
      return { ok: false, failure: Missing.Subscription };

    await this.unitOfWork.run(() => this.subscriptions.remove(subscription));
    return { ok: true, value: undefined };
  }
}
