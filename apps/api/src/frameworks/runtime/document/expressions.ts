// Runtime expressions in strict mode, the only mode this runtime evaluates: a text enclosed in
// `${ }` is a jq program, any other text is a literal.
export class Expressions {
  static readonly #ENCLOSED = /^\s*\$\{([\s\S]*)\}\s*$/;

  static encloses(text: string): boolean {
    return Expressions.#ENCLOSED.test(text);
  }

  // The jq program inside `${ }`.
  static programOf(text: string): string {
    const match = Expressions.#ENCLOSED.exec(text);

    if (match === null)
      throw new TypeError('The text is not a runtime expression');

    return match[1] ?? '';
  }
}
