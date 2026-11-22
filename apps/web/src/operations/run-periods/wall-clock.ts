const SECOND_MS = 1000;
const DAY_MS = 86_400_000;

export function wallClock(zone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

export function wallTimeOf(
  instant: number,
  clock: Intl.DateTimeFormat,
): number {
  const parts = clock.formatToParts(instant);
  const year = partOf(parts, "year");
  const month = partOf(parts, "month");
  const day = partOf(parts, "day");
  const hour = partOf(parts, "hour");
  const minute = partOf(parts, "minute");
  const second = partOf(parts, "second");
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

export function instantOf(wall: number, clock: Intl.DateTimeFormat): number {
  const before = wall - offsetAt(wall - DAY_MS, clock);
  const after = wall - offsetAt(wall + DAY_MS, clock);
  const held = [before, after].filter(
    (instant) => wallTimeOf(instant, clock) === wall,
  );

  if (held.length === 0) return before;

  return Math.min(...held);
}

function offsetAt(instant: number, clock: Intl.DateTimeFormat): number {
  const wall = wallTimeOf(instant, clock);
  const whole = instant - (instant % SECOND_MS);
  return wall - whole;
}

function partOf(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((candidate) => candidate.type === type);
  return Number(part?.value);
}
