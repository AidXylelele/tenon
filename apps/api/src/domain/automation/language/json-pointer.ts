export class JsonPointer {
  static readonly #SEPARATOR = '/';
  static readonly #TILDE = '~';

  readonly #tokens: readonly string[];

  constructor(tokens: readonly string[]) {
    this.#tokens = tokens;
  }

  static root(): JsonPointer {
    const tokens: readonly string[] = [];
    return new JsonPointer(tokens);
  }

  static parse(text: string): JsonPointer {
    const parts = text.split(JsonPointer.#SEPARATOR).slice(1);
    const tokens = parts.map((part) =>
      part
        .replaceAll('~1', JsonPointer.#SEPARATOR)
        .replaceAll('~0', JsonPointer.#TILDE),
    );
    return new JsonPointer(tokens);
  }

  get tokens(): readonly string[] {
    return this.#tokens;
  }

  equals(other: JsonPointer): boolean {
    const own = this.toString();
    const others = other.toString();
    return own === others;
  }

  at(segment: string | number): JsonPointer {
    const token = String(segment);
    const tokens = this.#tokens.concat(token);
    return new JsonPointer(tokens);
  }

  idIn(prefix: string): string {
    const pointer = this.toString();
    return `${prefix}${pointer}`;
  }

  toString(): string {
    const parts = this.#tokens.map((token) => {
      const tildeEscaped = token.replaceAll(JsonPointer.#TILDE, '~0');
      const escaped = tildeEscaped.replaceAll(JsonPointer.#SEPARATOR, '~1');
      return `${JsonPointer.#SEPARATOR}${escaped}`;
    });
    return parts.join('');
  }
}
