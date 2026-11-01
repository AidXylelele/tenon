import type { ErrorProperty } from './enums.js';
import type { WorkflowError } from './workflow-error.js';

export class ErrorFilter {
  readonly #expected: ReadonlyMap<ErrorProperty, string | number>;

  constructor(expected: ReadonlyMap<ErrorProperty, string | number>) {
    this.#expected = expected;
  }

  static none(): ErrorFilter {
    const expected = new Map<ErrorProperty, string | number>();
    return new ErrorFilter(expected);
  }

  matches(error: WorkflowError): boolean {
    for (const property of this.#expected.keys()) {
      const expected = this.#expected.get(property);
      const actual = error.property(property);

      if (actual !== expected) return false;
    }

    return true;
  }
}
