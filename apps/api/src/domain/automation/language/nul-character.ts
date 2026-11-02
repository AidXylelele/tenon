import type { JsonValue } from './interfaces.js';

// PostgreSQL keeps no U+0000 in jsonb, so a value holding one cannot be recorded. In JSON text
// the character is the escape `\u0000` after an even number of backslashes.
export class NulCharacter {
  static readonly #ESCAPED = /(?:^|[^\\])(?:\\\\)*\\u0000/;

  static isIn(value: JsonValue): boolean {
    const text = JSON.stringify(value);
    return NulCharacter.#ESCAPED.test(text);
  }
}
