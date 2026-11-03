import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { Evaluator } from '../evaluator.js';
import type { Scope } from '../scope.js';
import type { RetryPolicy } from './retry-policy.js';

// A `catch`: which errors it catches (the static filter `errors.with`, then `when` and
// `exceptWhen` with the error bound to its variable) and whether a caught error is retried.
export class CatchClause {
  static readonly #FILTERED = ['type', 'status', 'instance', 'title'];

  readonly #clause: Specification.TryTaskCatch;

  constructor(clause: Specification.TryTaskCatch) {
    this.#clause = clause;
  }

  get variable(): string {
    return this.#clause.as ?? 'error';
  }

  get handler(): Specification.TaskList | null {
    return this.#clause.do ?? null;
  }

  async catches(
    error: JsonObject,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    evaluator: Evaluator,
  ): Promise<boolean> {
    const matches = this.#matches(error);

    if (!matches) return false;

    const bound = this.#bound(args, error);
    const when = this.#clause.when;

    if (when !== undefined) {
      const holds = await evaluator.condition(
        when,
        input,
        bound,
        scope.pointer,
      );

      if (!holds) return false;
    }

    const exceptWhen = this.#clause.exceptWhen;

    if (exceptWhen === undefined) return true;

    const excepted = await evaluator.condition(
      exceptWhen,
      input,
      bound,
      scope.pointer,
    );
    return !excepted;
  }

  async retries(
    policy: RetryPolicy,
    error: JsonObject,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    evaluator: Evaluator,
  ): Promise<boolean> {
    const bound = this.#bound(args, error);
    const when = policy.when;

    if (when !== null) {
      const holds = await evaluator.condition(
        when,
        input,
        bound,
        scope.pointer,
      );

      if (!holds) return false;
    }

    const exceptWhen = policy.exceptWhen;

    if (exceptWhen === null) return true;

    const excepted = await evaluator.condition(
      exceptWhen,
      input,
      bound,
      scope.pointer,
    );
    return !excepted;
  }

  #matches(error: JsonObject): boolean {
    const filter = (this.#clause.errors?.with ?? {}) as JsonObject;

    for (const key of CatchClause.#FILTERED) {
      const expected = filter[key];

      if (expected !== undefined && error[key] !== expected) return false;
    }

    const details = filter.details;
    return details === undefined || error.detail === details;
  }

  #bound(args: JsonObject, error: JsonObject): JsonObject {
    const bound: Record<string, JsonValue> = {};
    Object.assign(bound, args);
    bound[this.variable] = error;
    return bound;
  }
}
