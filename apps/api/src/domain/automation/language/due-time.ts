// The time something is due — a deadline, a wake-up — or none.
export class DueTime {
  static readonly None = new DueTime(null);

  readonly #time: Date | null;

  private constructor(time: Date | null) {
    this.#time = time;
  }

  static of(time: Date | null): DueTime {
    if (time === null) return DueTime.None;

    return new DueTime(time);
  }

  // For the work data crossing the ports and for persistence.
  get time(): Date | null {
    return this.#time;
  }

  isNone(): boolean {
    return this.#time === null;
  }

  isDue(now: Date): boolean {
    if (this.#time === null) return false;

    return this.#time <= now;
  }

  earlierOf(other: DueTime): DueTime {
    if (other.#time === null) return this;

    if (this.#time === null) return other;

    if (other.#time < this.#time) return other;

    return this;
  }
}
