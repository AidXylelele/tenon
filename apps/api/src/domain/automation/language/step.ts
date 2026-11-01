import type { TaskStart } from './interfaces.js';

export class Step<P> {
  readonly #progress: P;
  readonly #starts: readonly TaskStart[];
  #retried: boolean;

  constructor(progress: P, starts: readonly TaskStart[]) {
    this.#progress = progress;
    this.#starts = starts;
    this.#retried = false;
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

  get retried(): boolean {
    return this.#retried;
  }

  asRetry(): Step<P> {
    const retry = new Step(this.#progress, this.#starts);
    retry.#retried = true;
    return retry;
  }

  toward<Q>(progress: Q): Step<Q> {
    const step = new Step(progress, this.#starts);
    step.#retried = this.#retried;
    return step;
  }
}
