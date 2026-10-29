export class Problem {
  readonly #pointer: string;
  readonly #reason: string;

  constructor(pointer: string, reason: string) {
    this.#pointer = pointer;
    this.#reason = reason;
  }

  get pointer(): string {
    return this.#pointer;
  }

  get reason(): string {
    return this.#reason;
  }
}
