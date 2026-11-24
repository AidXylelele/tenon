import type { Trigger } from "language-server/protocol";
import type { Schedule } from "@/libs/data-access/types";
import { cronText } from "./repeats";

const UNITS: readonly (readonly [string, number])[] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

export function scheduleText(schedule: Schedule): string {
  switch (schedule.kind) {
    case "every": {
      const duration = durationWords(schedule.interval);
      return everyText(duration);
    }
    case "cron":
      return cronText(schedule.cron);
    case "after": {
      const duration = durationWords(schedule.delay);
      return afterText(duration);
    }
    case "on":
      return onText(schedule.stream);
  }
}

export function triggerText(trigger: Trigger): string {
  switch (trigger.kind) {
    case "every": {
      const duration = spanOf(trigger.milliseconds, trigger.summary);
      return everyText(duration);
    }
    case "cron":
      return cronText(trigger.summary);
    case "after": {
      const duration = spanOf(trigger.milliseconds, trigger.summary);
      return afterText(duration);
    }
    case "on":
      return onText(trigger.summary);
  }
}

export function spanOf(milliseconds: number | null, written: string): string {
  if (milliseconds === null) return written;

  return durationWords(milliseconds);
}

function everyText(duration: string): string {
  return `Every ${duration}`;
}

function afterText(duration: string): string {
  return `${duration} after the previous run ends`;
}

function onText(stream: string): string {
  return `When an event on ${stream} arrives`;
}

function durationWords(milliseconds: number): string {
  const fitting = UNITS.find(([, size]) => milliseconds % size === 0);
  const [unit, size] = fitting ?? ["millisecond", 1];
  const count = milliseconds / size;
  const plural = `${unit}s`;
  const named = count === 1 ? unit : plural;
  return `${String(count)} ${named}`;
}
