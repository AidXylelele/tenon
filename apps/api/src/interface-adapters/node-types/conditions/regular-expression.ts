import { RE2JS } from 're2js';

export class RegularExpression {
  static readonly MAX_LENGTH = 1000;

  readonly #compiled: RE2JS;

  private constructor(compiled: RE2JS) {
    this.#compiled = compiled;
  }

  static problemOf(pattern: string): string | null {
    if (pattern.length > RegularExpression.MAX_LENGTH) {
      return `A regular expression has at most ${RegularExpression.MAX_LENGTH} characters`;
    }

    try {
      RE2JS.compile(pattern);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  static compile(pattern: string, ignoreCase: boolean): RegularExpression {
    const flags = ignoreCase ? RE2JS.CASE_INSENSITIVE : 0;
    const compiled = RE2JS.compile(pattern, flags);
    return new RegularExpression(compiled);
  }

  test(text: string): boolean {
    return this.#compiled.matcher(text).find();
  }

  replaceAll(text: string, replacement: string): string {
    return this.#compiled.matcher(text).replaceAll(replacement);
  }
}
