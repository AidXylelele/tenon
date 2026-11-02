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
import type { WorkKey } from './work-key.js';

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
    key: WorkKey,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const when = this.#when?.evaluationsFor(key, data, args) ?? [];
    const exceptWhen = this.#exceptWhen?.evaluationsFor(key, data, args) ?? [];
    return when.concat(exceptWhen);
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const when = this.#when?.failureIn(key, results, at) ?? null;

    if (when !== null) return when;

    return this.#exceptWhen?.failureIn(key, results, at) ?? null;
  }

  holds(key: WorkKey, results: RoundResults): boolean {
    const when = this.#when?.holds(key, results) ?? true;
    const excepted = this.#exceptWhen?.holds(key, results) ?? false;
    return when && !excepted;
  }
}
