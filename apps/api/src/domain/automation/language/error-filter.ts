import type { ErrorProperty } from './enums.js';

export class ErrorFilter {
  readonly #expected: ReadonlyMap<ErrorProperty, string | number>;

  constructor(expected: ReadonlyMap<ErrorProperty, string | number>) {
    this.#expected = expected;
  }

  static none(): ErrorFilter {
    const expected = new Map<ErrorProperty, string | number>();
    return new ErrorFilter(expected);
  }

  get expected(): ReadonlyMap<ErrorProperty, string | number> {
    return this.#expected;
  }
}
