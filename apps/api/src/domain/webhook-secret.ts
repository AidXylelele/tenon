import { randomBytes } from 'node:crypto';

export class WebhookSecret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static generate(): WebhookSecret {
    const value = randomBytes(32).toString('base64url');
    return new WebhookSecret(value);
  }

  get value(): string {
    return this.#value;
  }
}
