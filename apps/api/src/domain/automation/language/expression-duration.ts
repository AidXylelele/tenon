import type { Expression } from './expression.js';

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
}
