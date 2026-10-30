import { PointerToken } from './enums.js';

export class JsonPointer {
  readonly #tokens: readonly string[];

  constructor(tokens: readonly string[]) {
    this.#tokens = tokens;
  }

  static root(): JsonPointer {
    const tokens: readonly string[] = [];
    return new JsonPointer(tokens);
  }

  at(segment: string | number): JsonPointer {
    const token = String(segment);
    const tokens = this.#tokens.concat(token);
    return new JsonPointer(tokens);
  }

  toString(): string {
    const parts = this.#tokens.map((token) => {
      const tildeEscaped = token.replaceAll(
        PointerToken.Tilde,
        PointerToken.EscapedTilde,
      );
      const escaped = tildeEscaped.replaceAll(
        PointerToken.Separator,
        PointerToken.EscapedSeparator,
      );
      return `${PointerToken.Separator}${escaped}`;
    });
    return parts.join('');
  }
}
