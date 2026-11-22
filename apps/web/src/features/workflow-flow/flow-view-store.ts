import type { FlowView } from "./interfaces";

export class FlowViewStore {
  #shown: FlowView;
  readonly #listeners = new Set<() => void>();

  constructor(first: FlowView) {
    this.#shown = first;
  }

  readonly view = (): FlowView => this.#shown;

  readonly show = (next: FlowView): void => {
    this.#shown = next;
    this.#listeners.forEach((listener) => {
      listener();
    });
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  };
}
