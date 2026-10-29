import type { ParsedErrorFilter } from './interfaces.js';
import type { WorkflowError } from './workflow-error.js';

export class ErrorFilter {
  readonly #expected: ReadonlyMap<string, string | number>;

  constructor(expected: ReadonlyMap<string, string | number>) {
    this.#expected = expected;
  }

  static read(parsed: ParsedErrorFilter | undefined): ErrorFilter {
    const expected = new Map<string, string | number>();
    const properties = parsed?.with ?? {};

    for (const property of Object.keys(properties)) {
      const value = properties[property];

      if (value !== undefined) expected.set(property, value);
    }

    return new ErrorFilter(expected);
  }

  matches(error: WorkflowError): boolean {
    for (const [property, value] of this.#expected) {
      const actual = error.property(property);

      if (actual !== value) return false;
    }

    return true;
  }
}
