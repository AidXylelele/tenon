import { temporalDurationOf } from "./duration.js";

export function instantAfterTextOf(now: number, text: string): number | null {
  const duration = temporalDurationOf(text);

  if (duration === null) {
    return null;
  }

  return instantAfterOf(now, duration);
}

export function instantTextOf(epochMilliseconds: number): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(epochMilliseconds);
  return instant.toString({ fractionalSecondDigits: 3 });
}

function instantAfterOf(
  now: number,
  duration: Temporal.Duration,
): number | null {
  const start = Temporal.Instant.fromEpochMilliseconds(now);

  try {
    const zoned = start.toZonedDateTimeISO("UTC");
    return zoned.add(duration).epochMilliseconds;
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}
