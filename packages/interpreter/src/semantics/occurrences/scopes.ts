import type { BinderBinding } from "./types.js";

export class Scope {
  readonly #binders: ReadonlyMap<string, BinderBinding>;

  constructor(binders: readonly BinderBinding[], enclosing: Scope | null) {
    const enclosed = enclosing?.binders ?? [];
    const entries = binders.map((binder) => [binder.name, binder] as const);

    this.#binders = new Map([...enclosed, ...entries]);
  }

  get binders(): ReadonlyMap<string, BinderBinding> {
    return this.#binders;
  }

  inside(binders: readonly BinderBinding[]): Scope {
    return new Scope(binders, this);
  }
}
