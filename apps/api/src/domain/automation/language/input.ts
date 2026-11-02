import type { Expression } from './expression.js';
import type {
  Evaluation,
  InputProps,
  JsonObject,
  JsonValue,
  Validation,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { Schema } from './schema.js';
import type { Template } from './template.js';
import type { WorkflowError } from './workflow-error.js';

export class Input {
  readonly #from: Expression | Template | null;
  readonly #schema: Schema | null;

  constructor(props: InputProps) {
    this.#from = props.from;
    this.#schema = props.schema;
  }

  static none(): Input {
    return new Input({ from: null, schema: null });
  }

  get expressions(): readonly Expression[] {
    return this.#from?.expressions ?? [];
  }

  get schemas(): readonly Schema[] {
    if (this.#schema === null) return [];

    return [this.#schema];
  }

  evaluationsFor(
    prefix: string,
    rawInput: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    return this.#from?.evaluationsFor(prefix, rawInput, args) ?? [];
  }

  validationsFor(prefix: string, rawInput: JsonValue): readonly Validation[] {
    return this.#schema?.validationsFor(prefix, rawInput) ?? [];
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const invalid = this.#schema?.failureIn(prefix, results, at) ?? null;

    if (invalid !== null) return invalid;

    return this.#from?.failureIn(prefix, results, at) ?? null;
  }

  valueFrom(
    prefix: string,
    results: RoundResults,
    rawInput: JsonValue,
  ): JsonValue {
    if (this.#from === null) return rawInput;

    return this.#from.fill(prefix, results);
  }
}
