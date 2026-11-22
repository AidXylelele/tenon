import type {
  Bucket,
  BucketUnit,
  Period,
  PeriodWindows,
  TimeWindow,
} from "./interfaces";
import { instantOf, wallClock, wallTimeOf } from "./wall-clock";

interface Bucketing {
  readonly unit: BucketUnit;
  readonly count: number;
  readonly label: Intl.DateTimeFormatOptions;
}

const SECOND_MS = 1000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const BUCKETING: Record<Period, Bucketing> = {
  "24h": {
    unit: "hour",
    count: 24,
    label: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  },
  "7d": {
    unit: "day",
    count: 7,
    label: { weekday: "short", day: "numeric" },
  },
  "30d": {
    unit: "day",
    count: 30,
    label: { day: "numeric", month: "short" },
  },
};

export function windowsOf(
  period: Period,
  now: string,
  zone: string,
): PeriodWindows {
  const bucketing = BUCKETING[period];
  const at = Date.parse(now);
  const clock = wallClock(zone);
  const starts = startsOf(bucketing, at, clock);
  const from = starts[0] ?? at;

  const label = new Intl.DateTimeFormat("en-GB", {
    ...bucketing.label,
    timeZone: zone,
  });
  const buckets = starts.map((start, index) => {
    const end = starts[index + 1] ?? at;
    return bucketOf(start, end, label);
  });
  const current = windowOf(from, at);
  const previousFrom = from - (at - from);
  const previous = windowOf(previousFrom, from);

  return { current, previous, unit: bucketing.unit, buckets };
}

function startsOf(
  bucketing: Bucketing,
  at: number,
  clock: Intl.DateTimeFormat,
): number[] {
  switch (bucketing.unit) {
    case "hour":
      return hourStartsOf(bucketing.count, at, clock);
    case "day":
      return dayStartsOf(bucketing.count, at, clock);
  }
}

function hourStartsOf(
  count: number,
  at: number,
  clock: Intl.DateTimeFormat,
): number[] {
  const wall = wallTimeOf(at, clock);
  const intoHour = (wall % HOUR_MS) + (at % SECOND_MS);
  const current = at - intoHour;

  return Array.from(
    { length: count },
    (_, index) => current - (count - 1 - index) * HOUR_MS,
  );
}

function dayStartsOf(
  count: number,
  at: number,
  clock: Intl.DateTimeFormat,
): number[] {
  const wall = wallTimeOf(at, clock);
  const today = wall - (wall % DAY_MS);

  return Array.from({ length: count }, (_, index) => {
    const day = today - (count - 1 - index) * DAY_MS;
    return instantOf(day, clock);
  });
}

function bucketOf(
  start: number,
  end: number,
  label: Intl.DateTimeFormat,
): Bucket {
  const from = isoOf(start);
  const to = isoOf(end);
  const text = label.format(start);
  return { from, to, label: text };
}

function windowOf(start: number, end: number): TimeWindow {
  const from = isoOf(start);
  const to = isoOf(end);
  return { from, to };
}

function isoOf(instant: number): string {
  return new Date(instant).toISOString();
}
