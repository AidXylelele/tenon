import type { Trigger } from "language-server/protocol";
import type { Schedule } from "@/libs/data-access/types";

const UNITS: readonly (readonly [string, number])[] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

export function scheduleText(schedule: Schedule): string {
  switch (schedule.kind) {
    case "every":
      return everyText(durationWords(schedule.interval));
    case "cron":
      return cronText(schedule.cron);
    case "after":
      return afterText(durationWords(schedule.delay));
    case "on":
      return onText(schedule.stream);
  }
}

export function triggerText(trigger: Trigger): string {
  switch (trigger.kind) {
    case "every":
      return everyText(spanOf(trigger.milliseconds, trigger.summary));
    case "cron":
      return cronText(trigger.summary);
    case "after":
      return afterText(spanOf(trigger.milliseconds, trigger.summary));
    case "on":
      return onText(trigger.summary);
  }
}

export function spanOf(milliseconds: number | null, written: string): string {
  return milliseconds === null ? written : durationWords(milliseconds);
}

function everyText(duration: string): string {
  return `Every ${duration}`;
}

function cronText(cron: string): string {
  return `On the schedule ${cron} (UTC)`;
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
  const plural = count === 1 ? unit : `${unit}s`;
  return `${String(count)} ${plural}`;
}
