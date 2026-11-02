import { DefaultVariable } from './enums.js';
import type { ErrorCondition } from './error-condition.js';
import type { ErrorFilter } from './error-filter.js';
import type { Expression } from './expression.js';
import type {
  CatchClauseProps,
  Evaluation,
  JsonObject,
  JsonValue,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RetryStrategy } from './retry-strategy.js';
import type { RoundResults } from './round-results.js';
import type { TaskList } from './task-list.js';
import type { WorkflowError } from './workflow-error.js';
import { VariableName } from './variable-name.js';
import type { WorkKey } from './work-key.js';

export class CatchClause {
  readonly #filter: ErrorFilter;
  readonly #as: VariableName;
  readonly #condition: ErrorCondition;
  readonly #retry: RetryStrategy | null;
  readonly #handler: TaskList | null;

  constructor(props: CatchClauseProps) {
    this.#filter = props.filter;
    const as = props.as ?? DefaultVariable.Error;
    const asAt = props.reference.at('as');
    this.#as = new VariableName(as, asAt);
    this.#condition = props.condition;
    this.#retry = props.retry;
    this.#handler = props.handler;
  }

  get variable(): VariableName {
    return this.#as;
  }

  get retry(): RetryStrategy | null {
    return this.#retry;
  }

  get handler(): TaskList | null {
    return this.#handler;
  }

  get expressions(): readonly Expression[] {
    const condition = this.#condition.expressions;
    const retry = this.#retry?.expressions ?? [];
    const handler = this.#handler?.expressions ?? [];
    return condition.concat(retry, handler);
  }

  filters(error: WorkflowError): boolean {
    return this.#filter.matches(error);
  }

  variablesFor(error: WorkflowError): JsonObject {
    const variables: Record<string, JsonValue> = {};
    variables[this.#as.name] = error.toJson();
    return variables;
  }

  evaluationsFor(
    key: WorkKey,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const condition = this.#condition.evaluationsFor(key, data, args);
    const retry = this.#retry?.condition.evaluationsFor(key, data, args) ?? [];
    return condition.concat(retry);
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const condition = this.#condition.failureIn(key, results, at);

    if (condition !== null) return condition;

    return this.#retry?.condition.failureIn(key, results, at) ?? null;
  }

  catches(key: WorkKey, results: RoundResults): boolean {
    return this.#condition.holds(key, results);
  }

  retries(key: WorkKey, results: RoundResults): boolean {
    return this.#retry?.condition.holds(key, results) ?? false;
  }
}
