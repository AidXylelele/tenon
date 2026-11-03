import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';

// The values of secrets as a run reads and hides them: a JSON object (a `basic` policy's
// username and password, say) is read as JSON, anything else as text; every text of a value
// is replaced wherever it occurs in what leaves the run.
export class SecretValues {
  static readonly #MASK = '***';
  // A text this short would mask ordinary data where it happens to occur.
  static readonly #SHORTEST = 4;

  static parsed(value: string): JsonValue {
    try {
      const parsed = JSON.parse(value) as JsonValue;
      const object =
        parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      return object ? parsed : value;
    } catch {
      return value;
    }
  }

  static textsOf(secrets: JsonObject): string[] {
    const texts: string[] = [];
    SecretValues.#collect(secrets, texts);
    // Longer first, so a text that contains another is masked whole.
    return texts.sort((left, right) => right.length - left.length);
  }

  static #collect(value: JsonValue | undefined, texts: string[]): void {
    if (typeof value === 'string') {
      if (value.length >= SecretValues.#SHORTEST) texts.push(value);

      return;
    }

    if (value === null || typeof value !== 'object') return;

    for (const item of Object.values(value)) SecretValues.#collect(item, texts);
  }

  static masked<T extends JsonValue>(value: T, texts: readonly string[]): T {
    if (texts.length === 0) return value;

    return SecretValues.#masked(value, texts) as T;
  }

  static #masked(value: JsonValue, texts: readonly string[]): JsonValue {
    if (typeof value === 'string') {
      let masked = value;

      for (const text of texts)
        masked = masked.replaceAll(text, SecretValues.#MASK);

      return masked;
    }

    if (Array.isArray(value))
      return value.map((item) => SecretValues.#masked(item, texts));

    if (value === null || typeof value !== 'object') return value;

    const masked: Record<string, JsonValue> = {};

    for (const [key, item] of Object.entries(value))
      if (item !== undefined) masked[key] = SecretValues.#masked(item, texts);

    return masked;
  }
}
