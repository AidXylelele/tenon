import { randomUUID } from 'node:crypto';
import type {
  NewWebhook,
  WebhookCall,
  WebhookEvent,
  WebhookProps,
} from './interfaces.js';

export class Webhook {
  // The caller's credentials never reach an event (FR-024).
  static readonly #DROPPED = new Set(['authorization', 'cookie']);

  readonly #id: string;
  readonly #name: string;
  readonly #eventType: string;
  readonly #tokenFingerprint: string;
  readonly #createdAt: Date;

  constructor(props: WebhookProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#eventType = props.eventType;
    this.#tokenFingerprint = props.tokenFingerprint;
    this.#createdAt = props.createdAt;
  }

  static create(input: NewWebhook): Webhook {
    const id = randomUUID();
    return new Webhook({
      id,
      name: input.name,
      eventType: input.eventType,
      tokenFingerprint: input.token.fingerprint,
      createdAt: input.now,
    });
  }

  get id(): string {
    return this.#id;
  }

  get name(): string {
    return this.#name;
  }

  get eventType(): string {
    return this.#eventType;
  }

  get tokenFingerprint(): string {
    return this.#tokenFingerprint;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  // A call becomes one event of the webhook's type with the body, query and headers as data.
  receive(call: WebhookCall, now: Date): WebhookEvent {
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(call.headers)) {
      const lowered = name.toLowerCase();

      if (Webhook.#DROPPED.has(lowered)) continue;

      headers[lowered] = value;
    }

    const id = call.key ?? randomUUID();
    const data = { body: call.body, query: call.query, headers };
    return { id, webhookId: this.#id, type: this.#eventType, data, at: now };
  }
}
