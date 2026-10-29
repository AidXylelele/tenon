import type { ExpressionProps } from './interfaces.js';
import type { Scope } from './scope.js';

const RUNTIME_EXPRESSION = /^\s*\$\{([\s\S]*)\}\s*$/;

export class Expression {
  readonly #pointer: string;
  readonly #program: string;
  readonly #variables: readonly string[];

  constructor(props: ExpressionProps) {
    this.#pointer = props.pointer;
    this.#program = props.program;
    this.#variables = props.variables;
  }

  static isRuntime(text: string): boolean {
    return RUNTIME_EXPRESSION.test(text);
  }

  static read(text: string | undefined, scope: Scope): Expression | null {
    if (text === undefined) return null;

    const wrapped = RUNTIME_EXPRESSION.exec(text);
    const program = wrapped?.[1] ?? text;
    const trimmed = program.trim();
    const expression = new Expression({
      pointer: scope.pointer,
      program: trimmed,
      variables: scope.variables,
    });
    scope.register(expression);
    return expression;
  }

  get pointer(): string {
    return this.#pointer;
  }

  get program(): string {
    return this.#program;
  }

  get variables(): readonly string[] {
    return this.#variables;
  }
}
