import type { Expression } from './expression.js';
import type { InputProps, JsonObject } from './interfaces.js';
import type { Template } from './template.js';

export class Input {
  readonly #from: Expression | Template | null;
  readonly #schema: JsonObject | null;

  constructor(props: InputProps) {
    this.#from = props.from;
    this.#schema = props.schema;
  }

  static none(): Input {
    return new Input({ from: null, schema: null });
  }

  get from(): Expression | Template | null {
    return this.#from;
  }

  get schema(): JsonObject | null {
    return this.#schema;
  }

  get expressions(): readonly Expression[] {
    return this.#from?.expressions ?? [];
  }
}
