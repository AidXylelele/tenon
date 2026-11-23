import type { EditAction, FormField } from "language-server/protocol";
import type { StartReading, StartWay } from "./interfaces";
import { isObject, type Json } from "./json";

const TIMED_KEYS: readonly string[] = ["every", "after"];

const NOT_STARTED: StartReading = {
  way: "hand",
  cron: null,
  eventType: null,
  timed: null,
};

export function startOf(
  schedule: FormField | undefined,
  webhookTypes: readonly string[],
): StartReading {
  if (schedule === undefined || !isObject(schedule.value)) return NOT_STARTED;

  const value = schedule.value;
  const timed =
    schedule.fields.find(
      (member) => member.written && TIMED_KEYS.includes(member.key),
    ) ?? null;

  if (typeof value.cron === "string")
    return { way: "schedule", cron: value.cron, eventType: null, timed: null };

  if (timed !== null)
    return { way: "schedule", cron: null, eventType: null, timed };

  if (value.on === undefined) return NOT_STARTED;

  const eventType = eventTypeOf(value.on);
  const isWebhook = eventType !== null && webhookTypes.includes(eventType);
  const way = isWebhook ? "webhook" : "event";

  return { way, cron: null, eventType, timed: null };
}

function eventTypeOf(on: Json): string | null {
  const one = isObject(on) ? on.one : null;
  const filter = isObject(one) ? one.with : null;
  const type = isObject(filter) ? filter.type : null;

  return typeof type === "string" ? type : null;
}

export function startEditsOf(
  schedule: FormField,
  current: StartReading,
  way: StartWay,
  start: { readonly cron: string; readonly eventType: string | null },
): EditAction[] {
  if (way === current.way) return [];

  switch (way) {
    case "hand":
      return [{ kind: "clearField", pointer: schedule.pointer }];
    case "schedule":
      return cronEditsOf(schedule, start.cron);
    case "webhook":
      return start.eventType === null
        ? []
        : eventEditsOf(schedule, start.eventType);
    case "event":
      return eventEditsOf(schedule, "");
  }
}

export function cronEditsOf(schedule: FormField, cron: string): EditAction[] {
  const value = { cron };
  return [{ kind: "setField", pointer: schedule.pointer, value }];
}

export function eventEditsOf(
  schedule: FormField,
  eventType: string,
): EditAction[] {
  const value = { on: { one: { with: { type: eventType } } } };
  return [{ kind: "setField", pointer: schedule.pointer, value }];
}
