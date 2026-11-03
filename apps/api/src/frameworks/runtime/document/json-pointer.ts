// An RFC 6901 pointer into a workflow document.
export class JsonPointer {
  static readonly ROOT = new JsonPointer('');

  readonly #text: string;

  private constructor(text: string) {
    this.#text = text;
  }

  child(token: string | number): JsonPointer {
    const text = String(token);
    const escaped = text.replaceAll('~', '~0').replaceAll('/', '~1');
    return new JsonPointer(`${this.#text}/${escaped}`);
  }

  toString(): string {
    return this.#text;
  }
}
