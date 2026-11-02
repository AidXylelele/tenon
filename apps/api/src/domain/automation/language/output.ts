import type { Expression } from './expression.js';
import type {
  Evaluation,
  OutputProps,
  JsonObject,
  JsonValue,
  Validation,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { Schema } from './schema.js';
import type { Template } from './template.js';
import type { WorkflowError } from './workflow-error.js';

export class Output {
  readonly #as: Expression | Template | null;
  readonly #schema: Schema | null;

  constructor(props: OutputProps) {
    this.#as = props.as;
    this.#schema = props.schema;
  }

  static none(): Output {
    return new Output({ as: null, schema: null });
  }

  get expressions(): readonly Expression[] {
    return this.#as?.expressions ?? [];
  }

  get schemas(): readonly Schema[] {
    if (this.#schema === null) return [];

    return [this.#schema];
  }

  evaluationsFor(
    prefix: string,
    rawOutput: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    return this.#as?.evaluationsFor(prefix, rawOutput, args) ?? [];
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    return this.#as?.failureIn(prefix, results, at) ?? null;
  }

  valueFrom(
    prefix: string,
    results: RoundResults,
    rawOutput: JsonValue,
  ): JsonValue {
    if (this.#as === null) return rawOutput;

    return this.#as.fill(prefix, results);
  }

  validationsFor(prefix: string, value: JsonValue): readonly Validation[] {
    return this.#schema?.validationsFor(prefix, value) ?? [];
  }

  validationFailureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    return this.#schema?.failureIn(prefix, results, at) ?? null;
  }
}
