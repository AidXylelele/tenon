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

export class CatchClause {
  readonly #filter: ErrorFilter;
  readonly #as: string;
  readonly #condition: ErrorCondition;
  readonly #retry: RetryStrategy | null;
  readonly #handler: TaskList | null;

  constructor(props: CatchClauseProps) {
    this.#filter = props.filter;
    this.#as = props.as ?? DefaultVariable.Error;
    this.#condition = props.condition;
    this.#retry = props.retry;
    this.#handler = props.handler;
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
    variables[this.#as] = error.toJson();
    return variables;
  }

  evaluationsFor(
    prefix: string,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const condition = this.#condition.evaluationsFor(prefix, data, args);
    const retry =
      this.#retry?.condition.evaluationsFor(prefix, data, args) ?? [];
    return condition.concat(retry);
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const condition = this.#condition.failureIn(prefix, results, at);

    if (condition !== null) return condition;

    return this.#retry?.condition.failureIn(prefix, results, at) ?? null;
  }

  catches(prefix: string, results: RoundResults): boolean {
    return this.#condition.holds(prefix, results);
  }

  retries(prefix: string, results: RoundResults): boolean {
    return this.#retry?.condition.holds(prefix, results) ?? false;
  }
}
