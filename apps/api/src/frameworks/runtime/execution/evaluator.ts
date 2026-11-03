import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import { Expressions } from '../document/expressions.js';
import type { JsonPointer } from '../document/json-pointer.js';
import { JqOutcomeKind } from '../enums.js';
import type { JqClient } from '../interfaces.js';
import { ErrorKind, TaskFault } from './faults.js';

// Runtime expressions with jq. A value written in the document is a template: its `${ }` texts
// are evaluated and the rest is literal. A field that is an expression by definition (`if`,
// `when`, `input.from`, `output.as`…) is one whether or not it is enclosed.
export class Evaluator {
  constructor(private readonly jq: JqClient) {}

  async template(
    value: JsonValue,
    data: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    if (typeof value === 'string') {
      if (!Expressions.encloses(value)) return value;

      const program = Expressions.programOf(value);
      return this.#evaluated(program, data, args, at);
    }

    if (Array.isArray(value)) {
      const items: JsonValue[] = [];

      for (const item of value) {
        const filled = await this.template(item, data, args, at);
        items.push(filled);
      }

      return items;
    }

    if (value === null || typeof value !== 'object') return value;

    const filled: Record<string, JsonValue> = {};

    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;

      filled[key] = await this.template(item, data, args, at);
    }

    return filled;
  }

  async expression(
    text: string,
    data: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    const program = Expressions.encloses(text)
      ? Expressions.programOf(text)
      : text;
    return this.#evaluated(program, data, args, at);
  }

  // A condition holds when it evaluates to true; anything else is false.
  async condition(
    text: string,
    data: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<boolean> {
    const value = await this.expression(text, data, args, at);
    return value === true;
  }

  // jq answers with a stream of values: none is null, one is itself, several are an array.
  async #evaluated(
    program: string,
    data: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    const evaluation = await this.jq.evaluate(program, data, args);

    if (evaluation.kind === JqOutcomeKind.Evaluated) {
      const values = evaluation.values;

      if (values.length === 0) return null;

      if (values.length === 1) return values[0] ?? null;

      return values.slice();
    }

    if (evaluation.kind === JqOutcomeKind.Failure)
      throw TaskFault.of(ErrorKind.Expression, at, evaluation.failure);

    throw TaskFault.of(
      ErrorKind.Expression,
      at,
      'The expression did not finish within its limits',
    );
  }
}
