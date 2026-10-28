import { createHash, randomBytes } from 'node:crypto';

export class InvitationToken {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static generate(): InvitationToken {
    return new InvitationToken(randomBytes(32).toString('base64url'));
  }

  get value(): string {
    return this.#value;
  }

  get hash(): string {
    return createHash('sha256').update(this.#value).digest('hex');
  }
}
