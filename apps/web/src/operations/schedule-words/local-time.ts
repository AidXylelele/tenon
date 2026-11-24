import { cronTableOf, startsOf } from "./cron-table";
import type { Repeat, TimeOfDay } from "./interfaces";
import { repeatOf, repeatOfTable, timeOfDayOf } from "./repeats";

type DayShift = "before" | "same" | "after";

const UTC = "UTC";
const YOUR_TIME = "your time";
const SHIFT =
  "local time shifts with daylight saving, the schedule stays in UTC.";
const NOTICE_DAYS = 7;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const DAY_WORDS: Record<DayShift, string> = {
  before: ", the day before",
  same: "",
  after: ", the next day",
};

const utcClock = clockIn(UTC);
const utcDates = datesIn(UTC);

export function localTimeText(
  cron: string,
  now: string,
  zone: string,
): string | null {
  const repeat = repeatOf(cron);
  const at = timeOfDayOf(repeat);

  if (at === null) return null;

  const instant = Date.parse(now);
  const today = todayAt(at, instant);
  const clock = clockIn(zone);
  const time = clock.format(today);
  const days = dayWordsOf(repeat, today, zone);
  return `${time} ${YOUR_TIME}${days}`;
}

export function daylightNote(
  cron: string,
  now: string,
  zone: string,
): string | null {
  const table = cronTableOf(cron);

  if (table === null) return null;

  const repeat = repeatOfTable(table, cron);
  const at = timeOfDayOf(repeat);

  if (at === null) return null;

  const after = Date.parse(now);
  const clock = clockIn(zone);
  const today = todayAt(at, after);
  const usual = clock.format(today);
  const until = after + NOTICE_DAYS * DAY_MS;
  const starts = startsOf(table, after, NOTICE_DAYS);
  const soon = starts.filter((start) => start <= until);
  const shifted = soon.find((start) => clock.format(start) !== usual);

  if (shifted === undefined) return null;

  const dates = datesIn(zone);
  const date = dates.format(shifted);
  const time = clock.format(shifted);
  return `From ${date} it starts at ${time} ${YOUR_TIME}: ${SHIFT}`;
}

export function startText(start: string, zone: string): string {
  const at = Date.parse(start);
  const date = utcDates.format(at);
  const time = utcClock.format(at);
  const local = localWhenOf(at, zone);
  return `${date} ${time} UTC · ${local} ${YOUR_TIME}`;
}

function localWhenOf(at: number, zone: string): string {
  const dates = datesIn(zone);
  const clock = clockIn(zone);
  const time = clock.format(at);
  const shift = dayShiftOf(at, dates);

  if (shift === "same") return time;

  const date = dates.format(at);
  return `${date} ${time}`;
}

function dayWordsOf(repeat: Repeat, at: number, zone: string): string {
  if (repeat.kind === "daily") return "";

  const dates = datesIn(zone);
  const shift = dayShiftOf(at, dates);
  return DAY_WORDS[shift];
}

function dayShiftOf(at: number, dates: Intl.DateTimeFormat): DayShift {
  const local = dates.format(at);
  const utcToday = utcDates.format(at);
  const tomorrow = at + DAY_MS;
  const utcTomorrow = utcDates.format(tomorrow);

  if (local === utcToday) return "same";

  if (local === utcTomorrow) return "after";

  return "before";
}

function todayAt(at: TimeOfDay, instant: number): number {
  const midnight = instant - (instant % DAY_MS);
  return midnight + at.hour * HOUR_MS + at.minute * MINUTE_MS;
}

function clockIn(zone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function datesIn(zone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
