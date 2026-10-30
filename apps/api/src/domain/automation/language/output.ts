import type { Expression } from './expression.js';
import type { JsonObject, OutputProps } from './interfaces.js';
import type { Template } from './template.js';

export class Output {
  readonly #as: Expression | Template | null;
  readonly #schema: JsonObject | null;

  constructor(props: OutputProps) {
    this.#as = props.as;
    this.#schema = props.schema;
  }

  static none(): Output {
    return new Output({ as: null, schema: null });
  }

  get as(): Expression | Template | null {
    return this.#as;
  }

  get schema(): JsonObject | null {
    return this.#schema;
  }

  get expressions(): readonly Expression[] {
    return this.#as?.expressions ?? [];
  }
}
