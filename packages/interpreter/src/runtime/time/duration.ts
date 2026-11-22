export function temporalDurationOf(
  definition: Temporal.DurationLike,
): Temporal.Duration | null {
  try {
    return Temporal.Duration.from(definition);
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

export function hasCalendarUnits(duration: Temporal.Duration): boolean {
  return duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0;
}

export function fixedMillisecondsOf(duration: Temporal.Duration): number {
  return duration.total({ unit: "milliseconds" });
}
