import type { TaskStart } from './interfaces.js';

export class Step<P> {
  readonly #progress: P;
  readonly #starts: readonly TaskStart[];

  constructor(progress: P, starts: readonly TaskStart[]) {
    this.#progress = progress;
    this.#starts = starts;
  }

  static of<P>(progress: P): Step<P> {
    const starts: readonly TaskStart[] = [];
    return new Step(progress, starts);
  }

  get progress(): P {
    return this.#progress;
  }

  get starts(): readonly TaskStart[] {
    return this.#starts;
  }
}
