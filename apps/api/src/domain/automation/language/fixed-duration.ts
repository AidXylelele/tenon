export class FixedDuration {
  readonly #value: Temporal.Duration;

  constructor(value: Temporal.Duration) {
    this.#value = value;
  }

  endFrom(start: Date): Date {
    const startMs = start.getTime();
    const instant = Temporal.Instant.fromEpochMilliseconds(startMs);
    const zoned = instant.toZonedDateTimeISO('UTC');
    const end = zoned.add(this.#value);
    return new Date(end.epochMilliseconds);
  }

  milliseconds(start: Date): number {
    const end = this.endFrom(start);
    return end.getTime() - start.getTime();
  }
}
