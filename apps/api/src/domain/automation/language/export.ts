import type { Expression } from './expression.js';
import type {
  Evaluation,
  ExportProps,
  JsonObject,
  JsonValue,
  Validation,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { Schema } from './schema.js';
import type { Template } from './template.js';
import type { WorkflowError } from './workflow-error.js';

export class Export {
  readonly #as: Expression | Template | null;
  readonly #schema: Schema | null;

  constructor(props: ExportProps) {
    this.#as = props.as;
    this.#schema = props.schema;
  }

  static none(): Export {
    return new Export({ as: null, schema: null });
  }

  get expressions(): readonly Expression[] {
    return this.#as?.expressions ?? [];
  }

  get schemas(): readonly Schema[] {
    if (this.#schema === null) return [];

    return [this.#schema];
  }

  changesContext(): boolean {
    return this.#as !== null;
  }

  evaluationsFor(
    prefix: string,
    output: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    return this.#as?.evaluationsFor(prefix, output, args) ?? [];
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    return this.#as?.failureIn(prefix, results, at) ?? null;
  }

  contextFrom(
    prefix: string,
    results: RoundResults,
    context: JsonValue,
  ): JsonValue {
    if (this.#as === null) return context;

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
