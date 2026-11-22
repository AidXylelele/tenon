import type { JsonObject, JsonValue, SchemaAt } from "interpreter/front-end";
import { isJsonObject } from "../pointers/index.js";

const durationUnits: readonly string[] = [
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];

const noAmounts: ReadonlyMap<string, number> = new Map();

export function isDurationAt(entries: readonly SchemaAt[]): boolean {
  return entries.some((entry) => {
    const names = entry.members.map((member) => member.name);
    const isUnits =
      names.length === durationUnits.length &&
      durationUnits.every((unit) => names.includes(unit));

    return isUnits && entry.types.includes("string");
  });
}

export function amountsOf(
  written: JsonValue | undefined,
): ReadonlyMap<string, number> {
  if (typeof written === "string") {
    return writtenAmountsOf(written);
  }

  if (isJsonObject(written)) {
    return memberAmountsOf(written);
  }

  return noAmounts;
}

function memberAmountsOf(written: JsonObject): ReadonlyMap<string, number> {
  const members = Object.entries(written);
  const amounts = members.filter(
    (member): member is [string, number] => typeof member[1] === "number",
  );

  return new Map(amounts);
}

function writtenAmountsOf(text: string): ReadonlyMap<string, number> {
  const duration = durationOf(text);

  if (duration === null) {
    return noAmounts;
  }

  const isPrecise =
    duration.sign >= 0 &&
    duration.years === 0 &&
    duration.months === 0 &&
    duration.microseconds === 0 &&
    duration.nanoseconds === 0;

  if (!isPrecise) {
    return noAmounts;
  }

  const days = duration.weeks * 7 + duration.days;
  const amounts = [
    ["days", days],
    ["hours", duration.hours],
    ["minutes", duration.minutes],
    ["seconds", duration.seconds],
    ["milliseconds", duration.milliseconds],
  ] as const;
  const given = amounts.filter(([, amount]) => amount > 0);

  return new Map(given);
}

function durationOf(text: string): Temporal.Duration | null {
  try {
    return Temporal.Duration.from(text);
  } catch {
    return null;
  }
}
