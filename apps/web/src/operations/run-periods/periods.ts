import type { BucketUnit, Period, Started } from "./interfaces";

interface PeriodWords {
  readonly label: string;
  readonly phrase: string;
}

const PERIOD: Record<Started, PeriodWords> = {
  "24h": { label: "24 hours", phrase: "in the last 24 hours" },
  "7d": { label: "7 days", phrase: "in the last 7 days" },
  "30d": { label: "30 days", phrase: "in the last 30 days" },
  all: { label: "Any time", phrase: "at any time" },
};

export const PERIODS: readonly Period[] = ["24h", "7d", "30d"];

export const STARTED: readonly Started[] = ["24h", "7d", "30d", "all"];

const numbers = new Intl.NumberFormat("en-US");

export function periodLabel(started: Started): string {
  return PERIOD[started].label;
}

export function periodPhrase(started: Started): string {
  return PERIOD[started].phrase;
}

export function startedOf(text: string | undefined): Started | null {
  return STARTED.find((started) => started === text) ?? null;
}

export function changeText(
  current: number,
  previous: number,
  period: Period,
): string {
  const direction = directionOf(current, previous);
  const before = numbers.format(previous);
  const label = periodLabel(period);
  return `${direction} ${before} the previous ${label}`;
}

function directionOf(current: number, previous: number): string {
  if (current > previous) return "↑ from";
  if (current < previous) return "↓ from";
  return "same as";
}

export function chartNoteOf(unit: BucketUnit, zone: string): string {
  const bars = unit === "hour" ? "Each bar is an hour" : "Each bar is a day";
  const clock = zone === "UTC" ? "UTC" : `your time zone, ${zone}`;
  return `${bars} in ${clock}.`;
}
