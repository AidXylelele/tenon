import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Subscription } from "../../../domain/automation/subscriptions/subscription.js";
import { SecretRepository } from "../secrets/ports.js";
import { EndpointRefusal } from "./enums.js";
import type {
  CreateSubscriptionCommand,
  CreateSubscriptionResult,
} from "./interfaces.js";
import {
  EventSender,
  SubscriptionFilters,
  SubscriptionRepository,
} from "./ports.js";

@Injectable()
export class CreateSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly filters: SubscriptionFilters,
    private readonly secrets: SecretRepository,
    private readonly sender: EventSender,
  ) {}

  @Transactional()
  async execute(
    command: CreateSubscriptionCommand,
  ): Promise<CreateSubscriptionResult> {
    const now = new Date();
    const compiled = await this.filters.check(command.filter);

    if (!compiled.ok) return compiled;

    const admitted = await this.sender.admits(command.endpoint.uri);

    if (!admitted)
      return { ok: false, failure: EndpointRefusal.PrivateAddress };

    const owned = await this.secrets.findOwnedBy(command.ownerId);
    const created = Subscription.create({
      ownerId: command.ownerId,
      name: command.name,
      endpoint: command.endpoint,
      filter: command.filter,
      ownedSecrets: owned,
      now,
    });

    if (!created.ok) return created;

    const subscription = created.value;
    await this.subscriptions.add(subscription);
    const view = {
      id: subscription.id,
      name: subscription.name,
      endpoint: subscription.endpoint,
      filter: subscription.filter,
      createdAt: subscription.createdAt,
    };
    return { ok: true, value: view };
  }
}
