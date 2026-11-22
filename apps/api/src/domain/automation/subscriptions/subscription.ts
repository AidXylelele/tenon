import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import { SubscriptionRefusal } from "./enums.js";
import type {
  DeliveryEndpoint,
  NewSubscription,
  SubscriptionProps,
} from "./interfaces.js";

export class Subscription {
  readonly #id: string;
  readonly #ownerId: string;
  readonly #name: string;
  readonly #endpoint: DeliveryEndpoint;
  readonly #filter: SubscriptionProps["filter"];
  readonly #createdAt: Date;

  constructor(props: SubscriptionProps) {
    this.#id = props.id;
    this.#ownerId = props.ownerId;
    this.#name = props.name;
    this.#endpoint = props.endpoint;
    this.#filter = props.filter;
    this.#createdAt = props.createdAt;
  }

  static create(
    input: NewSubscription,
  ): Result<Subscription, SubscriptionRefusal> {
    const secret = input.endpoint.secret;
    const owned = input.ownedSecrets.some((held) => held.name === secret);

    if (secret !== null && !owned)
      return { ok: false, failure: SubscriptionRefusal.ForeignSecret };

    const id = randomUUID();
    const subscription = new Subscription({
      id,
      ownerId: input.ownerId,
      name: input.name,
      endpoint: input.endpoint,
      filter: input.filter,
      createdAt: input.now,
    });
    return { ok: true, value: subscription };
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get name(): string {
    return this.#name;
  }

  get endpoint(): DeliveryEndpoint {
    return this.#endpoint;
  }

  get filter(): SubscriptionProps["filter"] {
    return this.#filter;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }
}
