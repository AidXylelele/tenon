// An RFC 6901 pointer into a workflow document.
export class JsonPointer {
  static readonly ROOT = new JsonPointer('');

  readonly #text: string;

  private constructor(text: string) {
    this.#text = text;
  }

  child(token: string | number): JsonPointer {
    const escaped = JsonPointer.escaped(token);
    return new JsonPointer(`${this.#text}/${escaped}`);
  }

  // A reference token as RFC 6901 writes it (`~` as `~0`, `/` as `~1`), and back.
  static escaped(token: string | number): string {
    return String(token).replaceAll('~', '~0').replaceAll('/', '~1');
  }

  static unescaped(token: string): string {
    return token.replaceAll('~1', '/').replaceAll('~0', '~');
  }

  toString(): string {
    return this.#text;
  }
}
