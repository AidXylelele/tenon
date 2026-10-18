import { FormulaError } from './formula-error.js';

export class FormulaBudget {
  static readonly MAX_STEPS = 100_000;
  static readonly MAX_MS = 100;
  static readonly MAX_BYTES = 1024 * 1024;

  readonly #deadline: number;
  #steps = 0;

  constructor() {
    this.#deadline = Date.now() + FormulaBudget.MAX_MS;
  }

  tick(): void {
    this.#steps += 1;

    if (this.#steps > FormulaBudget.MAX_STEPS) {
      throw new FormulaError('limit', 'The formula takes too many steps');
    }

    const now = Date.now();

    if (now > this.#deadline) {
      throw new FormulaError(
        'limit',
        `The formula ran longer than ${FormulaBudget.MAX_MS} ms`,
      );
    }
  }

  allowLength(length: number): void {
    if (length > FormulaBudget.MAX_BYTES) {
      throw new FormulaError('limit', 'The formula result is larger than 1 MB');
    }
  }
}
