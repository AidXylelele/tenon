import type { JsonValue } from '../../../domain/automation/json.js';
import { JsonPointer } from './json-pointer.js';

export interface LocatedValue {
  readonly pointer: JsonPointer;
  readonly key: string;
  readonly value: JsonValue;
}

// Every value of a JSON document with its pointer, depth first, leaving out the subtrees under
// the keys it is told to skip.
export class JsonWalk {
  readonly #skipped: ReadonlySet<string>;
  readonly #found: LocatedValue[] = [];

  private constructor(skipped: ReadonlySet<string>) {
    this.#skipped = skipped;
  }

  static valuesOf(
    document: JsonValue,
    skipped: ReadonlySet<string>,
  ): readonly LocatedValue[] {
    const walk = new JsonWalk(skipped);
    walk.#visit(JsonPointer.ROOT, '', document);
    return walk.#found;
  }

  #visit(pointer: JsonPointer, key: string, value: JsonValue): void {
    const skipped = this.#skipped.has(key);

    if (skipped) return;

    const located = { pointer, key, value };
    this.#found.push(located);

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const child = pointer.child(index);
        this.#visit(child, key, item);
      }
      return;
    }

    if (value === null || typeof value !== 'object') return;

    for (const [name, item] of Object.entries(value)) {
      if (item === undefined) continue;

      const child = pointer.child(name);
      this.#visit(child, name, item);
    }
  }
}
