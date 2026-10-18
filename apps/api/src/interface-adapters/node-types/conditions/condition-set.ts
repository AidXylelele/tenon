import { ConditionRule } from './condition-rule.js';
import type { Conditions } from './conditions-schema.js';

export class ConditionSet {
  readonly #rules: readonly ConditionRule[];
  readonly #every: boolean;

  constructor(conditions: Conditions) {
    this.#rules = conditions.rules.map(
      (rule) => new ConditionRule(rule, conditions.ignoreCase),
    );
    this.#every = conditions.combinator === 'and';
  }

  holds(): boolean {
    if (this.#every) return this.#rules.every((rule) => rule.holds());

    return this.#rules.some((rule) => rule.holds());
  }
}
