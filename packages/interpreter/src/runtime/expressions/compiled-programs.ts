import type { ExpressionCompilation } from "./types.js";

export class CompiledPrograms {
  readonly #bound: number;
  readonly #compilations = new Map<string, ExpressionCompilation>();

  constructor(bound: number) {
    this.#bound = bound;
  }

  compilationOf(
    program: string,
    compile: () => ExpressionCompilation,
  ): ExpressionCompilation {
    const kept = this.#compilations.get(program);

    if (kept !== undefined) {
      this.#markMostRecent(program, kept);
      return kept;
    }

    const compilation = compile();

    this.#freeze(compilation);
    this.#keep(program, compilation);
    return compilation;
  }

  #markMostRecent(program: string, compilation: ExpressionCompilation): void {
    this.#compilations.delete(program);
    this.#compilations.set(program, compilation);
  }

  #freeze(compilation: ExpressionCompilation): void {
    Object.freeze(compilation);

    if (compilation.kind === "compiled") {
      Object.freeze(compilation.expression);
      Object.freeze(compilation.expression.names);
    }
  }

  #keep(program: string, compilation: ExpressionCompilation): void {
    this.#compilations.set(program, compilation);

    if (this.#compilations.size <= this.#bound) {
      return;
    }

    const [leastRecent] = this.#compilations.keys();

    if (leastRecent === undefined) {
      return;
    }

    this.#compilations.delete(leastRecent);
  }
}
