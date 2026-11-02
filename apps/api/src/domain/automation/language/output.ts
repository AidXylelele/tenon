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
import type { WorkKey } from './work-key.js';

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
    key: WorkKey,
    rawOutput: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    return this.#as?.evaluationsFor(key, rawOutput, args) ?? [];
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    return this.#as?.failureIn(key, results, at) ?? null;
  }

  valueFrom(
    key: WorkKey,
    results: RoundResults,
    rawOutput: JsonValue,
  ): JsonValue {
    if (this.#as === null) return rawOutput;

    return this.#as.fill(key, results);
  }

  validationsFor(key: WorkKey, value: JsonValue): readonly Validation[] {
    return this.#schema?.validationsFor(key, value) ?? [];
  }

  validationFailureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    return this.#schema?.failureIn(key, results, at) ?? null;
  }
}
