import { Expression } from './expression.js';
import type {
  Evaluation,
  JsonObject,
  JsonValue,
  TemplateProps,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';

export class Template {
  readonly #pointer: JsonPointer;
  readonly #value: JsonValue;

  constructor(props: TemplateProps) {
    this.#pointer = props.pointer;
    this.#value = props.value;
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  get value(): JsonValue {
    return this.#value;
  }

  get expressions(): readonly Expression[] {
    return this.#expressionsIn(this.#value, this.#pointer);
  }

  evaluationsFor(
    prefix: string,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const found: Evaluation[] = [];

    for (const expression of this.expressions) {
      const evaluations = expression.evaluationsFor(prefix, data, args);

      for (const evaluation of evaluations) found.push(evaluation);
    }

    return found;
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    for (const expression of this.expressions) {
      const failure = expression.failureIn(prefix, results, at);

      if (failure !== null) return failure;
    }

    return null;
  }

  fill(prefix: string, results: RoundResults): JsonValue {
    return this.#filled(this.#value, this.#pointer, prefix, results);
  }

  #filled(
    value: JsonValue,
    at: JsonPointer,
    prefix: string,
    results: RoundResults,
  ): JsonValue {
    if (typeof value === 'string') {
      const runtime = Expression.isRuntime(value);

      if (!runtime) return value;

      const expression = Expression.of({ text: value, pointer: at });
      return expression.fill(prefix, results);
    }

    if (value === null || typeof value !== 'object') return value;

    if (Array.isArray(value))
      return value.map((item, index) => {
        const itemAt = at.at(index);
        return this.#filled(item, itemAt, prefix, results);
      });

    const filled: Record<string, JsonValue> = {};

    for (const key of Object.keys(value)) {
      const item = value[key];

      if (item === undefined) continue;

      const itemAt = at.at(key);
      filled[key] = this.#filled(item, itemAt, prefix, results);
    }

    return filled;
  }

  #expressionsIn(value: JsonValue, at: JsonPointer): readonly Expression[] {
    if (typeof value === 'string') {
      const runtime = Expression.isRuntime(value);

      if (!runtime) return [];

      const expression = Expression.of({ text: value, pointer: at });
      return [expression];
    }

    if (value === null || typeof value !== 'object') return [];

    const found: Expression[] = [];

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemAt = at.at(index);
        const inner = this.#expressionsIn(item, itemAt);

        for (const expression of inner) found.push(expression);
      });
      return found;
    }

    for (const key of Object.keys(value)) {
      const item = value[key];

      if (item === undefined) continue;

      const itemAt = at.at(key);
      const inner = this.#expressionsIn(item, itemAt);

      for (const expression of inner) found.push(expression);
    }

    return found;
  }
}
