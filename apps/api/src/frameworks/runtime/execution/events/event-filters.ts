import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import { Expressions } from '../../document/expressions.js';
import type { JsonPointer } from '../../document/json-pointer.js';
import type { Evaluator } from '../evaluator.js';

// An event filter (DSL 1.0.3, "Event Filter"): each attribute in `with` is a regular expression
// the event's attribute must match whole, a runtime expression over the attribute's value that
// must hold or give that value (the reference's `data: ${ .temperature > 38 }`), or for `data`
// an object the event's data must contain; each correlation's `from` value must equal its
// `expect`, or the first value extracted.
export class EventFilters {
  constructor(private readonly evaluator: Evaluator) {}

  async matches(
    filter: JsonObject,
    event: JsonObject,
    correlation: Record<string, JsonValue>,
    at: JsonPointer,
  ): Promise<boolean> {
    const attributes = (filter.with ?? {}) as JsonObject;

    for (const [name, expected] of Object.entries(attributes)) {
      if (expected === undefined) continue;

      const actual = event[name] ?? null;
      const holds = await this.#holds(expected, actual, at);

      if (!holds) return false;
    }

    return this.#correlates(filter, event, correlation, at);
  }

  async #holds(
    expected: JsonValue,
    actual: JsonValue,
    at: JsonPointer,
  ): Promise<boolean> {
    if (typeof expected === 'string' && Expressions.encloses(expected)) {
      const value = await this.evaluator.expression(expected, actual, {}, at);

      if (typeof value === 'boolean') return value;

      return EventFilters.#equal(value, actual);
    }

    if (typeof expected === 'string') {
      if (typeof actual !== 'string') return false;

      const pattern = new RegExp(`^(?:${expected})$`, 'u');
      return pattern.test(actual);
    }

    if (
      expected !== null &&
      typeof expected === 'object' &&
      !Array.isArray(expected)
    )
      return this.#contains(expected, actual, at);

    return EventFilters.#equal(expected, actual);
  }

  async #contains(
    expected: JsonObject,
    actual: JsonValue,
    at: JsonPointer,
  ): Promise<boolean> {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual))
      return false;

    for (const [name, value] of Object.entries(expected)) {
      if (value === undefined) continue;

      const held = await this.#holds(value, actual[name] ?? null, at);

      if (!held) return false;
    }

    return true;
  }

  async #correlates(
    filter: JsonObject,
    event: JsonObject,
    correlation: Record<string, JsonValue>,
    at: JsonPointer,
  ): Promise<boolean> {
    const keys = (filter.correlate ?? {}) as JsonObject;

    for (const [key, definition] of Object.entries(keys)) {
      const declared = (definition ?? {}) as JsonObject;
      const from = typeof declared.from === 'string' ? declared.from : '.';
      const value = await this.evaluator.expression(from, event, {}, at);
      const expect = declared.expect;
      const expected =
        typeof expect === 'string' && Expressions.encloses(expect)
          ? await this.evaluator.expression(expect, event, {}, at)
          : (expect ?? correlation[key]);

      if (expected !== undefined && !EventFilters.#equal(expected, value))
        return false;

      correlation[key] = value;
    }

    return true;
  }

  static #equal(left: JsonValue, right: JsonValue): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
