import { FormulaError } from '../../formulas/formula-error.js';
import { Formula } from '../../formulas/formula.js';
import { ParameterError } from './parameter-error.js';
import type { ParameterValue } from './parameter-value.js';
import type { ResolutionContext } from './resolution-context.js';

export class FormulaValue implements ParameterValue {
  readonly #path: string;
  readonly #source: string;
  readonly #formula: Formula | null;
  readonly #error: FormulaError | null;

  constructor(path: string, source: string) {
    this.#path = path;
    this.#source = source;
    let formula: Formula | null = null;
    let error: FormulaError | null = null;

    try {
      formula = Formula.parse(source);
    } catch (caught) {
      if (!(caught instanceof FormulaError)) throw caught;

      error = caught;
    }

    this.#formula = formula;
    this.#error = error;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return true;
  }

  get source(): string {
    return this.#source;
  }

  get error(): FormulaError | null {
    return this.#error;
  }

  get nodeNames(): string[] {
    return this.#formula?.nodeNames ?? [];
  }

  resolve(context: ResolutionContext): unknown {
    if (!this.#formula) {
      throw new ParameterError(this.#path, this.#error!.message, false);
    }

    try {
      return this.#formula.evaluate(context.formulaScope);
    } catch (caught) {
      if (!(caught instanceof FormulaError)) throw caught;

      const overLimit = caught.code === 'limit';
      throw new ParameterError(this.#path, caught.message, overLimit);
    }
  }

  sketch(): undefined {
    return undefined;
  }

  leaves(): ParameterValue[] {
    return [this];
  }

  renameNodes(names: ReadonlyMap<string, string>): unknown {
    if (!this.#formula) return { formula: this.#source };

    return { formula: this.#formula.renameNodes(names) };
  }
}
