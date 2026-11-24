import { cronTableOf } from "./cron-table";
import type { CronTable, Repeat, TimeOfDay, Weekday } from "./interfaces";

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const ANY_WEEKDAY = "*";
const MONDAY_TO_FRIDAY = "1-5";
const WORKDAY_LIST = "1,2,3,4,5";
const WEEKDAY_NAME: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const MONTHS_IN_YEAR = 12;
const DAYS_IN_MONTH = 31;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;

const NINE: TimeOfDay = { hour: 9, minute: 0 };

export const FIRST_CRON = "0 9 * * *";

export const REPEAT_CHOICES: readonly Repeat[] = [
  { kind: "daily", at: NINE },
  { kind: "weekdays", at: NINE },
  { kind: "hourly", minute: 0 },
  { kind: "minutes", every: 10 },
  { kind: "weekly", days: [1], at: NINE },
  { kind: "custom", cron: FIRST_CRON },
];

const conjunction = new Intl.ListFormat("en-GB", { type: "conjunction" });

export function cronText(cron: string): string {
  const repeat = repeatOf(cron);
  return repeatText(repeat);
}

export function repeatLabel(repeat: Repeat): string {
  switch (repeat.kind) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Every weekday";
    case "hourly":
      return "Every hour";
    case "minutes":
      return minutesText(repeat.every);
    case "weekly":
      return "Every week on…";
    case "custom":
      return "A custom schedule (cron)";
  }
}

export function repeatOf(cron: string): Repeat {
  const table = cronTableOf(cron);

  if (table === null) return { kind: "custom", cron };

  return repeatOfTable(table, cron);
}

export function repeatOfTable(table: CronTable, cron: string): Repeat {
  const built = builtOf(table);
  return built ?? { kind: "custom", cron };
}

export function cronOf(repeat: Repeat): string {
  switch (repeat.kind) {
    case "daily":
      return timedCronOf(repeat.at, ANY_WEEKDAY);
    case "weekdays":
      return timedCronOf(repeat.at, MONDAY_TO_FRIDAY);
    case "hourly":
      return `${String(repeat.minute)} * * * *`;
    case "minutes":
      return minutesCronOf(repeat.every);
    case "weekly":
      return weeklyCronOf(repeat.days, repeat.at);
    case "custom":
      return repeat.cron;
  }
}

export function timeOfDayOf(repeat: Repeat): TimeOfDay | null {
  switch (repeat.kind) {
    case "daily":
    case "weekdays":
    case "weekly":
      return repeat.at;
    case "hourly":
    case "minutes":
    case "custom":
      return null;
  }
}

function repeatText(repeat: Repeat): string {
  switch (repeat.kind) {
    case "daily":
      return timedText("Every day", repeat.at);
    case "weekdays":
      return timedText("Every weekday", repeat.at);
    case "hourly":
      return hourlyText(repeat.minute);
    case "minutes":
      return minutesText(repeat.every);
    case "weekly":
      return weeklyText(repeat.days, repeat.at);
    case "custom":
      return `On the schedule ${repeat.cron} (UTC)`;
  }
}

function builtOf(table: CronTable): Repeat | null {
  const weekdays = weekdaysOf(table);

  if (weekdays === null) return null;

  const at = timeOf(table);

  if (at !== null) return timedOf(at, weekdays);

  const everyHour = table.hours.length === HOURS_IN_DAY;
  const everyDay = weekdays.length === WEEKDAYS.length;

  if (!everyHour) return null;

  if (!everyDay) return null;

  return untimedOf(table.minutes);
}

function weekdaysOf(table: CronTable): readonly Weekday[] | null {
  const everyMonth = table.months.size === MONTHS_IN_YEAR;
  const everyDayOfMonth = table.days.size === DAYS_IN_MONTH;
  const either = table.daysRestricted && table.weekdaysRestricted;

  if (!everyMonth) return null;

  if (!everyDayOfMonth) return null;

  if (either) return WEEKDAYS;

  return WEEKDAYS.filter((weekday) => table.weekdays.has(weekday));
}

function timeOf(table: CronTable): TimeOfDay | null {
  if (table.hours.length !== 1) return null;

  if (table.minutes.length !== 1) return null;

  const [hour = 0] = table.hours;
  const [minute = 0] = table.minutes;
  return { hour, minute };
}

function timedOf(at: TimeOfDay, weekdays: readonly Weekday[]): Repeat {
  const days = weekdays.join(",");

  if (weekdays.length === WEEKDAYS.length) return { kind: "daily", at };

  if (days === WORKDAY_LIST) return { kind: "weekdays", at };

  return { kind: "weekly", days: weekdays, at };
}

function untimedOf(minutes: readonly number[]): Repeat | null {
  const [minute = 0] = minutes;

  if (minutes.length === 1) return { kind: "hourly", minute };

  const every = MINUTES_IN_HOUR / minutes.length;
  const even = minutes.every((value, index) => value === index * every);

  if (!even) return null;

  return { kind: "minutes", every };
}

function timedCronOf(at: TimeOfDay, weekdays: string): string {
  const minute = String(at.minute);
  const hour = String(at.hour);
  return `${minute} ${hour} * * ${weekdays}`;
}

function minutesCronOf(every: number): string {
  if (every === 1) return "* * * * *";

  return `*/${String(every)} * * * *`;
}

function weeklyCronOf(days: readonly Weekday[], at: TimeOfDay): string {
  const sorted = days.toSorted((low, high) => low - high);
  const listed = sorted.join(",");
  return timedCronOf(at, listed);
}

function timedText(every: string, at: TimeOfDay): string {
  const time = timeText(at);
  return `${every} at ${time} UTC`;
}

function weeklyText(days: readonly Weekday[], at: TimeOfDay): string {
  const ordered = days.toSorted(
    (left, right) => mondayFirst(left) - mondayFirst(right),
  );
  const names = ordered.map((day) => WEEKDAY_NAME[day]);
  const listed = conjunction.format(names);
  const every = `Every ${listed}`;
  return timedText(every, at);
}

function hourlyText(minute: number): string {
  if (minute === 0) return "Every hour";

  if (minute === 1) return "Every hour at 1 minute past";

  return `Every hour at ${String(minute)} minutes past`;
}

function minutesText(every: number): string {
  if (every === 1) return "Every minute";

  return `Every ${String(every)} minutes`;
}

function timeText(at: TimeOfDay): string {
  const hour = String(at.hour).padStart(2, "0");
  const minute = String(at.minute).padStart(2, "0");
  return `${hour}:${minute}`;
}

function mondayFirst(day: Weekday): number {
  return (day + 6) % WEEKDAYS.length;
}
