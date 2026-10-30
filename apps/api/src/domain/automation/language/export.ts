import type { Expression } from './expression.js';
import type { ExportProps, JsonObject } from './interfaces.js';
import type { Template } from './template.js';

export class Export {
  readonly #as: Expression | Template | null;
  readonly #schema: JsonObject | null;

  constructor(props: ExportProps) {
    this.#as = props.as;
    this.#schema = props.schema;
  }

  static none(): Export {
    return new Export({ as: null, schema: null });
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
