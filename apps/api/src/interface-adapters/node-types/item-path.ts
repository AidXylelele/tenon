import type { Item } from '../../application/interfaces.js';
import { NodeUserError } from './node-user-error.js';

const RESERVED = ['__proto__', 'prototype', 'constructor'];

export class ItemPath {
  readonly #path: string;
  readonly #segments: readonly string[];

  constructor(path: string, dotNotation: boolean) {
    this.#path = path;
    this.#segments = dotNotation ? path.split('.') : [path];
  }

  read(item: Item): unknown {
    let current: unknown = item;

    for (const segment of this.#segments) {
      if (current === null || typeof current !== 'object') return undefined;

      const own = Object.hasOwn(current, segment);

      if (!own) return undefined;

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  write(item: Item, value: unknown): Item {
    this.assertSafe();
    const copy = structuredClone(item) as Record<string, unknown>;
    let current = copy;
    const last = this.#segments.length - 1;

    for (let index = 0; index < last; index++) {
      const segment = this.#segments[index]!;
      const next = ItemPath.own(current, segment);
      const isArray = Array.isArray(next);

      if (next === null || typeof next !== 'object' || isArray) {
        ItemPath.define(current, segment, {});
      }

      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = this.#segments[last]!;
    ItemPath.define(current, lastSegment, value);
    return copy;
  }

  remove(item: Item): Item {
    this.assertSafe();
    const copy = structuredClone(item) as Record<string, unknown>;
    let current = copy;
    const last = this.#segments.length - 1;

    for (let index = 0; index < last; index++) {
      const segment = this.#segments[index]!;
      const next = ItemPath.own(current, segment);

      if (next === null || typeof next !== 'object') return copy;

      current = next as Record<string, unknown>;
    }

    const lastSegment = this.#segments[last]!;
    const own = Object.hasOwn(current, lastSegment);

    if (own) delete current[lastSegment];

    return copy;
  }

  private assertSafe(): void {
    const reserved = this.#segments.some((segment) =>
      RESERVED.includes(segment),
    );

    if (!reserved) return;

    const names = RESERVED.join(', ');
    throw new NodeUserError(
      `The field path "${this.#path}" uses a reserved name (${names})`,
    );
  }

  private static own(
    container: Record<string, unknown>,
    segment: string,
  ): unknown {
    const own = Object.hasOwn(container, segment);
    return own ? container[segment] : undefined;
  }

  private static define(
    container: Record<string, unknown>,
    segment: string,
    value: unknown,
  ): void {
    Object.defineProperty(container, segment, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
