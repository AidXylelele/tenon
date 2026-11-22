import { createHash, randomBytes } from "node:crypto";

export class InvitationToken {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static generate(): InvitationToken {
    const bytes = randomBytes(32);
    const value = bytes.toString("base64url");
    return new InvitationToken(value);
  }

  get value(): string {
    return this.#value;
  }

  get hash(): string {
    return createHash("sha256").update(this.#value).digest("hex");
  }
}
