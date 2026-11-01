export class UserOrigin {
  readonly #userId: string;

  constructor(userId: string) {
    this.#userId = userId;
  }

  get userId(): string {
    return this.#userId;
  }
}
