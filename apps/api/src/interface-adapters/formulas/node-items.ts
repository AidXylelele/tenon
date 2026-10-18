export type FormulaItem = Readonly<Record<string, unknown>>;

export interface ItemView {
  readonly json: FormulaItem;
}

export class NodeItems {
  readonly #items: readonly FormulaItem[];
  readonly #index: number;

  constructor(items: readonly FormulaItem[], index: number) {
    this.#items = items;
    this.#index = index;
  }

  get item(): ItemView | undefined {
    return this.viewAt(this.#index);
  }

  all(): ItemView[] {
    return this.#items.map((json) => ({ json }));
  }

  first(): ItemView | undefined {
    return this.viewAt(0);
  }

  last(): ItemView | undefined {
    const lastIndex = this.#items.length - 1;
    return this.viewAt(lastIndex);
  }

  private viewAt(index: number): ItemView | undefined {
    const json = this.#items[index];
    return json === undefined ? undefined : { json };
  }
}
