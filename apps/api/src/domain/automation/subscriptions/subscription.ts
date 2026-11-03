import { randomUUID } from 'node:crypto';
import type { Result } from '../../result.js';
import { SubscriptionRefusal } from './enums.js';
import type {
  DeliveryEndpoint,
  NewSubscription,
  SubscriptionProps,
} from './interfaces.js';

// Its owner's request that the events matching a filter, accepted from now on, reach an
// endpoint (US6, FR-025). It is created whole and deleted whole.
export class Subscription {
  readonly #id: string;
  readonly #ownerId: string;
  readonly #name: string;
  readonly #endpoint: DeliveryEndpoint;
  readonly #filter: SubscriptionProps['filter'];
  readonly #types: readonly string[] | null;
  readonly #createdAt: Date;

  constructor(props: SubscriptionProps) {
    this.#id = props.id;
    this.#ownerId = props.ownerId;
    this.#name = props.name;
    this.#endpoint = props.endpoint;
    this.#filter = props.filter;
    this.#types = props.types;
    this.#createdAt = props.createdAt;
  }

  // Deliveries authenticate only with a secret their owner keeps (US6 AS2).
  static create(
    input: NewSubscription,
  ): Result<Subscription, SubscriptionRefusal> {
    const secret = input.endpoint.secret;

    if (secret !== null && !input.ownedSecrets.includes(secret))
      return { ok: false, failure: SubscriptionRefusal.ForeignSecret };

    const id = randomUUID();
    const subscription = new Subscription({
      id,
      ownerId: input.ownerId,
      name: input.name,
      endpoint: input.endpoint,
      filter: input.filter,
      types: input.types,
      createdAt: input.now,
    });
    return { ok: true, value: subscription };
  }

  isOwnedBy(ownerId: string): boolean {
    return this.#ownerId === ownerId;
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

  get filter(): SubscriptionProps['filter'] {
    return this.#filter;
  }

  get types(): readonly string[] | null {
    return this.#types;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }
}
