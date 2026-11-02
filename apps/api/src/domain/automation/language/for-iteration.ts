import { InconsistentProgressError } from '../../errors.js';
import type { ForIterationProps, JsonValue } from './interfaces.js';

// Where a `for` stands in the items it collected: the item at hand and the data the iterations
// passed on so far. The index past the last item ends the loop.
export class ForIteration {
  readonly #items: readonly JsonValue[];
  readonly #index: number;
  readonly #data: JsonValue;

  constructor(props: ForIterationProps) {
    const counted = Number.isInteger(props.index) && props.index >= 0;
    const within = props.index <= props.items.length;

    if (!counted || !within)
      throw new InconsistentProgressError(
        'a for iterates over the items it collected, from the first',
      );

    this.#items = props.items;
    this.#index = props.index;
    this.#data = props.data;
  }

  static first(items: readonly JsonValue[], data: JsonValue): ForIteration {
    return new ForIteration({ items, index: 0, data });
  }

  get items(): readonly JsonValue[] {
    return this.#items;
  }

  get index(): number {
    return this.#index;
  }

  get data(): JsonValue {
    return this.#data;
  }

  get item(): JsonValue {
    return this.#items[this.#index] ?? null;
  }

  isOver(): boolean {
    return this.#index >= this.#items.length;
  }

  next(output: JsonValue): ForIteration {
    const index = this.#index + 1;
    return new ForIteration({ items: this.#items, index, data: output });
  }
}
