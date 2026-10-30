import type { ExpressionProps, NewExpression } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

export class Expression {
  static readonly #RUNTIME = /^\s*\$\{([\s\S]*)\}\s*$/;

  readonly #pointer: JsonPointer;
  readonly #program: string;

  constructor(props: ExpressionProps) {
    this.#pointer = props.pointer;
    this.#program = props.program;
  }

  static isRuntime(text: string): boolean {
    return Expression.#RUNTIME.test(text);
  }

  static of(input: NewExpression): Expression {
    const wrapped = Expression.#RUNTIME.exec(input.text);
    const program = wrapped?.[1] ?? input.text;
    const trimmed = program.trim();
    return new Expression({ pointer: input.pointer, program: trimmed });
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  get program(): string {
    return this.#program;
  }

  get expressions(): readonly Expression[] {
    return [this];
  }
}
