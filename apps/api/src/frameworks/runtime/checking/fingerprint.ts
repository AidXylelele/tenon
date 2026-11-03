import { createHash } from 'node:crypto';
import type { JsonValue } from '../../../domain/automation/json.js';

// The SHA-256 of a document in canonical JSON (keys sorted at every level), so that the same
// content has the same fingerprint however its keys were ordered or stored.
export class Fingerprint {
  static of(document: JsonValue): string {
    const canonical = Fingerprint.#canonical(document);
    const text = JSON.stringify(canonical);
    return createHash('sha256').update(text).digest('hex');
  }

  static #canonical(value: JsonValue): JsonValue {
    if (Array.isArray(value))
      return value.map((item) => Fingerprint.#canonical(item));

    if (value === null || typeof value !== 'object') return value;

    const sorted: Record<string, JsonValue> = {};
    const keys = Object.keys(value).toSorted();

    for (const key of keys) {
      const item = value[key];

      if (item === undefined) continue;

      sorted[key] = Fingerprint.#canonical(item);
    }

    return sorted;
  }
}
