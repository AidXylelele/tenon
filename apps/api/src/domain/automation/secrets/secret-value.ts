import type { Result } from "../../interfaces.js";
import type { JsonValue } from "../interfaces.js";
import { SecretRefusal } from "./enums.js";

export class SecretValue {
  static readonly #SHORTEST = 4;

  readonly #text: string;

  constructor(text: string) {
    this.#text = text;
  }

  static of(text: string): Result<SecretValue, SecretRefusal> {
    const value = new SecretValue(text);
    const short = value.texts.some(
      (held) => held.length < SecretValue.#SHORTEST,
    );

    if (short) return { ok: false, failure: SecretRefusal.TooShort };

    return { ok: true, value };
  }

  get text(): string {
    return this.#text;
  }

  get held(): JsonValue {
    try {
      const parsed = JSON.parse(this.#text) as JsonValue;
      const object =
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);

      if (!object) return this.#text;

      return parsed;
    } catch {
      return this.#text;
    }
  }

  get texts(): string[] {
    return SecretValue.#textsIn(this.held);
  }

  static #textsIn(value: JsonValue | undefined): string[] {
    if (typeof value === "string") return [value];

    if (typeof value !== "object" || value === null) return [];

    return Object.values(value).flatMap((item) => SecretValue.#textsIn(item));
  }
}
