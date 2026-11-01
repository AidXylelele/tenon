import type { Expression } from './expression.js';
import type {
  ErrorConditionProps,
  Evaluation,
  JsonObject,
  JsonValue,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';

export class ErrorCondition {
  readonly #when: Expression | null;
  readonly #exceptWhen: Expression | null;

  constructor(props: ErrorConditionProps) {
    this.#when = props.when;
    this.#exceptWhen = props.exceptWhen;
  }

  static none(): ErrorCondition {
    return new ErrorCondition({ when: null, exceptWhen: null });
  }

  get expressions(): readonly Expression[] {
    const when = this.#when?.expressions ?? [];
    const exceptWhen = this.#exceptWhen?.expressions ?? [];
    return when.concat(exceptWhen);
  }

  evaluationsFor(
    prefix: string,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const when = this.#when?.evaluationsFor(prefix, data, args) ?? [];
    const exceptWhen =
      this.#exceptWhen?.evaluationsFor(prefix, data, args) ?? [];
    return when.concat(exceptWhen);
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const when = this.#when?.failureIn(prefix, results, at) ?? null;

    if (when !== null) return when;

    return this.#exceptWhen?.failureIn(prefix, results, at) ?? null;
  }

  holds(prefix: string, results: RoundResults): boolean {
    const when = this.#when?.holds(prefix, results) ?? true;
    const excepted = this.#exceptWhen?.holds(prefix, results) ?? false;
    return when && !excepted;
  }
}
