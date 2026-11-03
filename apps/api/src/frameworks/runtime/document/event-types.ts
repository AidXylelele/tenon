import type { JsonObject } from '../../../domain/automation/json.js';

// The event types a set of event filters takes: each filter's literal `type`, or null when a
// filter takes any type (one with no `type`, a pattern or an expression).
export class EventTypes {
  static readonly #LITERAL = /^[\w.-]+$/;

  static of(filters: readonly JsonObject[]): string[] | null {
    const types: string[] = [];

    for (const filter of filters) {
      const type = ((filter.with ?? {}) as JsonObject).type;
      const literal =
        typeof type === 'string' && EventTypes.#LITERAL.test(type);

      if (!literal) return null;

      types.push(type);
    }

    return types.length === 0 ? null : types;
  }

  // The filters of an event consumption strategy (`one`, `any` or `all`).
  static filtersOf(strategy: JsonObject): JsonObject[] {
    if (strategy.one !== undefined) return [strategy.one as JsonObject];

    if (strategy.all !== undefined) return strategy.all as JsonObject[];

    return (strategy.any ?? []) as JsonObject[];
  }
}
