import type { CronTable } from "./interfaces";

interface Field {
  readonly minimum: number;
  readonly maximum: number;
  readonly names: readonly string[];
}

interface Bounds {
  readonly low: number;
  readonly high: number;
}

const MINUTE: Field = { minimum: 0, maximum: 59, names: [] };
const HOUR: Field = { minimum: 0, maximum: 23, names: [] };
const DAY: Field = { minimum: 1, maximum: 31, names: [] };
const MONTH: Field = {
  minimum: 1,
  maximum: 12,
  names: "jan feb mar apr may jun jul aug sep oct nov dec".split(" "),
};
const WEEKDAY: Field = {
  minimum: 0,
  maximum: 7,
  names: "sun mon tue wed thu fri sat".split(" "),
};

const FIELD_COUNT = 5;
const DAYS_IN_WEEK = 7;
const HORIZON_YEARS = 8;
const HORIZON_DAYS = HORIZON_YEARS * 366;

const ANY = "*";
const LIST = ",";
const STEP = "/";
const RANGE = "-";
const NUMBER = /^[0-9]+$/;
const SPACES = /\s+/;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function nextStartsOf(
  cron: string,
  now: string,
  count: number,
): readonly string[] {
  const table = cronTableOf(cron);

  if (table === null) return [];

  const after = Date.parse(now);
  const starts = startsOf(table, after, count);
  return starts.map((start) => new Date(start).toISOString());
}

export function cronTableOf(cron: string): CronTable | null {
  const texts = cron.trim().split(SPACES);

  if (texts.length !== FIELD_COUNT) return null;

  const [
    minuteText = "",
    hourText = "",
    dayText = "",
    monthText = "",
    weekdayText = "",
  ] = texts;
  const minutes = valuesOf(minuteText, MINUTE);
  const hours = valuesOf(hourText, HOUR);
  const days = valuesOf(dayText, DAY);
  const months = valuesOf(monthText, MONTH);
  const weekdays = valuesOf(weekdayText, WEEKDAY).map(
    (weekday) => weekday % DAYS_IN_WEEK,
  );
  const fields = [minutes, hours, days, months, weekdays];
  const incomplete = fields.some((values) => values.length === 0);

  if (incomplete) return null;

  const times = timesOf(hours, minutes);
  const daysRestricted = !dayText.startsWith(ANY);
  const weekdaysRestricted = !weekdayText.startsWith(ANY);
  return {
    minutes,
    hours,
    times,
    days: new Set(days),
    months: new Set(months),
    weekdays: new Set(weekdays),
    daysRestricted,
    weekdaysRestricted,
  };
}

export function startsOf(
  table: CronTable,
  after: number,
  count: number,
): readonly number[] {
  if (count === 0) return [];

  const next = nextStartAfter(table, after);

  if (next === null) return [];

  const left = count - 1;
  const rest = startsOf(table, next, left);
  return [next].concat(rest);
}

function nextStartAfter(table: CronTable, after: number): number | null {
  const today = after - (after % DAY_MS);

  for (let index = 0; index < HORIZON_DAYS; index += 1) {
    const day = today + index * DAY_MS;
    const start = startOn(table, day, after);
    if (start !== null) return start;
  }

  return null;
}

function startOn(table: CronTable, day: number, after: number): number | null {
  const runs = runsOn(table, day);

  if (!runs) return null;

  const time = table.times.find((offset) => day + offset > after);

  if (time === undefined) return null;

  return day + time;
}

function runsOn(table: CronTable, day: number): boolean {
  const date = new Date(day);
  const month = date.getUTCMonth() + 1;
  const dayOfMonth = date.getUTCDate();
  const weekday = date.getUTCDay();
  const inMonth = table.months.has(month);
  const onDay = table.days.has(dayOfMonth);
  const onWeekday = table.weekdays.has(weekday);
  const either = table.daysRestricted && table.weekdaysRestricted;

  if (!inMonth) return false;

  if (either) return onDay || onWeekday;

  return onDay && onWeekday;
}

function timesOf(
  hours: readonly number[],
  minutes: readonly number[],
): number[] {
  return hours.flatMap((hour) => timesInHour(hour, minutes));
}

function timesInHour(hour: number, minutes: readonly number[]): number[] {
  const start = hour * HOUR_MS;
  return minutes.map((minute) => start + minute * MINUTE_MS);
}

function valuesOf(text: string, field: Field): number[] {
  const items = text.split(LIST).map((item) => itemValuesOf(item, field));
  const incomplete = items.some((values) => values.length === 0);

  if (incomplete) return [];

  const all = items.flat();
  const unique = new Set(all);
  return Array.from(unique).sort((low, high) => low - high);
}

function itemValuesOf(item: string, field: Field): number[] {
  const parts = item.split(STEP);

  if (parts.length > 2) return [];

  const [range = "", step] = parts;
  const size = stepOf(step);

  if (size === null) return [];

  const open = step !== undefined;
  const bounds = boundsOf(range, field, open);

  if (bounds === null) return [];

  return valuesBetween(bounds, size);
}

function stepOf(step: string | undefined): number | null {
  if (step === undefined) return 1;

  const size = Number(step);
  const valid = NUMBER.test(step) && size > 0;
  return valid ? size : null;
}

function boundsOf(range: string, field: Field, open: boolean): Bounds | null {
  if (range === ANY) return { low: field.minimum, high: field.maximum };

  const ends = range.split(RANGE);

  if (ends.length > 2) return null;

  const [first = "", last] = ends;
  const low = valueOf(first, field);

  if (low === null) return null;

  if (last === undefined) return { low, high: open ? field.maximum : low };

  const high = valueOf(last, field);

  if (high === null) return null;

  if (high < low) return null;

  return { low, high };
}

function valueOf(text: string, field: Field): number | null {
  const name = text.toLowerCase();
  const named = field.names.indexOf(name);

  if (named !== -1) return field.minimum + named;

  const value = Number(text);
  const valid =
    NUMBER.test(text) && value >= field.minimum && value <= field.maximum;
  return valid ? value : null;
}

function valuesBetween(bounds: Bounds, size: number): number[] {
  const count = Math.floor((bounds.high - bounds.low) / size) + 1;
  return Array.from({ length: count }, (_, index) => bounds.low + index * size);
}
