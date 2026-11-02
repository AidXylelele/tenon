import type { KeysetSlice } from './interfaces.js';

// A page read with `limit + 1` rows: the extra row only tells that another page follows.
export class KeysetPage {
  static of<R, P>(
    rows: readonly R[],
    limit: number,
    positionOf: (last: R) => P,
  ): KeysetSlice<R, P> {
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const more = rows.length > limit;

    if (!more || last === undefined) return { items, next: null };

    const next = positionOf(last);
    return { items, next };
  }
}
