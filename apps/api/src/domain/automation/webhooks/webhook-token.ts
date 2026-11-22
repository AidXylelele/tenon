import { createHash, randomBytes } from "node:crypto";

export class WebhookToken {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static generate(): WebhookToken {
    const value = randomBytes(32).toString("base64url");
    return new WebhookToken(value);
  }

  get value(): string {
    return this.#value;
  }

  get fingerprint(): string {
    return createHash("sha256").update(this.#value).digest("hex");
  }
}
