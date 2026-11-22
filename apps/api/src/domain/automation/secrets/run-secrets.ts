import type { JsonObject, JsonValue } from "../interfaces.js";
import type { HeldSecret } from "./interfaces.js";

export class RunSecrets {
  static readonly #MASK = "***";

  readonly #values: JsonObject;
  readonly #texts: readonly string[];

  constructor(values: JsonObject, texts: readonly string[]) {
    this.#values = values;
    this.#texts = texts;
  }

  static of(secrets: readonly HeldSecret[]): RunSecrets {
    const held: Record<string, JsonValue> = {};
    const texts: string[] = [];

    for (const secret of secrets) {
      held[secret.name] = secret.value.held;

      for (const text of secret.value.texts) texts.push(text);
    }

    return new RunSecrets(held, texts);
  }

  get values(): JsonObject {
    return this.#values;
  }

  textsWith(past: readonly string[]): readonly string[] {
    const known = new Set(past);

    for (const text of this.#texts) known.add(text);

    return Array.from(known).toSorted(
      (left, right) => right.length - left.length,
    );
  }

  mask(value: JsonValue, past: readonly string[]): JsonValue {
    const texts = this.textsWith(past);

    if (texts.length === 0) return value;

    return RunSecrets.#masked(value, texts);
  }

  maskObject(value: JsonObject, past: readonly string[]): JsonObject {
    const texts = this.textsWith(past);

    if (texts.length === 0) return value;

    return RunSecrets.#maskedObject(value, texts);
  }

  static #masked(value: JsonValue, texts: readonly string[]): JsonValue {
    if (typeof value === "string") return RunSecrets.#maskedText(value, texts);

    const list = RunSecrets.#isList(value);

    if (list) return value.map((item) => RunSecrets.#masked(item, texts));

    if (typeof value !== "object" || value === null) return value;

    return RunSecrets.#maskedObject(value, texts);
  }

  static #maskedObject(
    value: JsonObject,
    texts: readonly string[],
  ): JsonObject {
    const hidden: Record<string, JsonValue> = {};

    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;

      hidden[key] = RunSecrets.#masked(item, texts);
    }

    return hidden;
  }

  static #isList(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  static #maskedText(value: string, texts: readonly string[]): string {
    return texts.reduce(
      (hidden, text) => hidden.replaceAll(text, RunSecrets.#MASK),
      value,
    );
  }
}
