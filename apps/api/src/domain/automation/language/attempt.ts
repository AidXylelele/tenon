import { InconsistentProgressError } from '../../errors.js';
import type { AttemptProps } from './interfaces.js';

export class Attempt {
  readonly #count: number;
  readonly #firstStartedAt: Date;

  constructor(props: AttemptProps) {
    if (props.count < 0)
      throw new InconsistentProgressError('an attempt is counted from zero');

    this.#count = props.count;
    this.#firstStartedAt = props.firstStartedAt;
  }

  static first(now: Date): Attempt {
    return new Attempt({ count: 0, firstStartedAt: now });
  }

  get count(): number {
    return this.#count;
  }

  get firstStartedAt(): Date {
    return this.#firstStartedAt;
  }

  next(): Attempt {
    const count = this.#count + 1;
    return new Attempt({ count, firstStartedAt: this.#firstStartedAt });
  }
}
