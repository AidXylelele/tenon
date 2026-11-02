import { InvalidValueError } from '../../errors.js';
import { ErrorType } from './error-type.js';
import type { Expression } from './expression.js';
import { FixedDuration } from './fixed-duration.js';
import type { Evaluation, JsonObject, JsonValue } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';
import type { WorkKey } from './work-key.js';

export class ExpressionDuration {
  readonly #expression: Expression;

  constructor(expression: Expression) {
    this.#expression = expression;
  }

  get expression(): Expression {
    return this.#expression;
  }

  get expressions(): readonly Expression[] {
    return [this.#expression];
  }

  evaluationsFor(
    key: WorkKey,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    return this.#expression.evaluationsFor(key, data, args);
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const failure = this.#expression.failureIn(key, results, at);

    if (failure !== null) return failure;

    try {
      this.resolve(key, results);
      return null;
    } catch (error) {
      if (!(error instanceof InvalidValueError)) throw error;

      return ErrorType.Expression.errorAt(at, error.message);
    }
  }

  resolve(key: WorkKey, results: RoundResults): FixedDuration {
    const value = this.#expression.fill(key, results);
    return FixedDuration.fromValue(value);
  }
}
