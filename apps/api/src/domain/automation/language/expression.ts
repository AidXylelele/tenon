import type {
  Evaluation,
  ExpressionProps,
  JsonObject,
  JsonValue,
  NewExpression,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';
import type { WorkKey } from './work-key.js';

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

  evaluationsFor(
    key: WorkKey,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const id = key.idAt(this.#pointer);
    const evaluation: Evaluation = {
      id,
      program: this.#program,
      data,
      arguments: args,
    };
    return [evaluation];
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const id = key.idAt(this.#pointer);
    return results.failureOf(id, at);
  }

  fill(key: WorkKey, results: RoundResults): JsonValue {
    const id = key.idAt(this.#pointer);
    return results.valueOf(id);
  }

  holds(key: WorkKey, results: RoundResults): boolean {
    const value = this.fill(key, results);
    return value !== false && value !== null;
  }
}
