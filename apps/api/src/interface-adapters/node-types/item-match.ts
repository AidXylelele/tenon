import type { Item } from '../../application/interfaces.js';
import { ItemPath } from './item-path.js';

export interface FieldPair {
  readonly left: string;
  readonly right: string;
}

export class ItemMatch {
  readonly #leftKeys: readonly (string | null)[];
  readonly #rightKeys: readonly (string | null)[];
  readonly #leftsByKey: ReadonlyMap<string, readonly number[]>;
  readonly #rightsByKey: ReadonlyMap<string, readonly number[]>;

  constructor(
    pairs: readonly FieldPair[],
    left: readonly Item[],
    right: readonly Item[],
  ) {
    const leftPaths = pairs.map((pair) => new ItemPath(pair.left, true));
    const rightPaths = pairs.map((pair) => new ItemPath(pair.right, true));
    this.#leftKeys = left.map((item) => ItemMatch.keyOf(item, leftPaths));
    this.#rightKeys = right.map((item) => ItemMatch.keyOf(item, rightPaths));
    this.#leftsByKey = ItemMatch.indexed(this.#leftKeys);
    this.#rightsByKey = ItemMatch.indexed(this.#rightKeys);
  }

  static sameValue(left: unknown, right: unknown): boolean {
    if (left === undefined || right === undefined) return false;

    return ItemMatch.canonical(left) === ItemMatch.canonical(right);
  }

  rightMatchesOf(leftIndex: number): readonly number[] {
    return ItemMatch.partners(this.#leftKeys[leftIndex], this.#rightsByKey);
  }

  leftMatchesOf(rightIndex: number): readonly number[] {
    return ItemMatch.partners(this.#rightKeys[rightIndex], this.#leftsByKey);
  }

  private static partners(
    key: string | null | undefined,
    byKey: ReadonlyMap<string, readonly number[]>,
  ): readonly number[] {
    if (typeof key !== 'string') return [];

    return byKey.get(key) ?? [];
  }

  private static keyOf(item: Item, paths: readonly ItemPath[]): string | null {
    const values: string[] = [];

    for (const path of paths) {
      const value = path.read(item);

      if (value === undefined) return null;

      const canonical = ItemMatch.canonical(value);
      values.push(canonical);
    }

    return `[${values.join(',')}]`;
  }

  private static indexed(
    keys: readonly (string | null)[],
  ): Map<string, number[]> {
    const byKey = new Map<string, number[]>();

    keys.forEach((key, index) => {
      if (key === null) return;

      const indices = byKey.get(key) ?? [];
      indices.push(index);
      byKey.set(key, indices);
    });

    return byKey;
  }

  private static canonical(value: unknown): string {
    const isArray = Array.isArray(value);

    if (isArray) {
      const elements = value.map((element) => ItemMatch.canonical(element));
      return `[${elements.join(',')}]`;
    }

    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    const record = value as Readonly<Record<string, unknown>>;
    const fields: string[] = [];

    for (const name of Object.keys(record).sort()) {
      const key = JSON.stringify(name);
      const canonical = ItemMatch.canonical(record[name]);
      const field = `${key}:${canonical}`;
      fields.push(field);
    }

    return `{${fields.join(',')}}`;
  }
}
