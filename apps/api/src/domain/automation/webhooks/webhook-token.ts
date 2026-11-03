import { createHash, randomBytes } from 'node:crypto';

// The secret part of a webhook's URL: handed out once, kept only as its fingerprint (FR-024).
export class WebhookToken {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static generate(): WebhookToken {
    const value = randomBytes(32).toString('base64url');
    return new WebhookToken(value);
  }

  get value(): string {
    return this.#value;
  }

  get fingerprint(): string {
    return createHash('sha256').update(this.#value).digest('hex');
  }
}
