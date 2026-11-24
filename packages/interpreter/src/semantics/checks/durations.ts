import type {
  ContainerLifetime,
  Duration,
  Finding,
  Process,
  Schedule,
  Task,
} from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

type DurationMessage =
  | "invalidDuration"
  | "calendarSchedule"
  | "dynamicSchedule"
  | "calendarLifetime";

const none: readonly Finding[] = [];

export function checkDurations(subject: CheckSubject): readonly Finding[] {
  const occurrences = subject.occurrences;
  const durations = occurrences
    .filter((occurrence) => occurrence.kind === "duration")
    .map((occurrence) => occurrence.duration);
  const tasks = occurrences
    .filter((occurrence) => occurrence.kind === "task")
    .map((occurrence) => occurrence.task);

  return [
    ...durations.flatMap(unreadableDurationsOf),
    ...subject.workflow.schedules.flatMap(scheduleLengthsOf),
    ...tasks.flatMap(lifetimeLengthsOf),
  ];
}

function unreadableDurationsOf(duration: Duration): readonly Finding[] {
  switch (duration.kind) {
    case "invalid":
      return [durationFindingOf("invalidDuration", duration, duration.text)];
    case "fixed":
    case "calendar":
    case "computed":
      return none;
  }
}

function scheduleLengthsOf(schedule: Schedule): readonly Finding[] {
  switch (schedule.kind) {
    case "every":
      return scheduleLengthOf(schedule.interval);
    case "after":
      return scheduleLengthOf(schedule.delay);
    case "cron":
    case "on":
      return none;
  }
}

function scheduleLengthOf(duration: Duration): readonly Finding[] {
  switch (duration.kind) {
    case "calendar":
      return [durationFindingOf("calendarSchedule", duration, duration.iso)];
    case "computed": {
      const written = `\${ ${duration.expression.source} }`;
      return [durationFindingOf("dynamicSchedule", duration, written)];
    }
    case "fixed":
    case "invalid":
      return none;
  }
}

function lifetimeLengthsOf(task: Task): readonly Finding[] {
  switch (task.kind) {
    case "run":
      return processLifetimeLengthsOf(task.process);
    case "call":
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "set":
    case "switch":
    case "try":
    case "wait":
      return none;
  }
}

function processLifetimeLengthsOf(process: Process): readonly Finding[] {
  switch (process.kind) {
    case "container":
      return containerLifetimeLengthsOf(process.lifetime);
    case "script":
    case "shell":
    case "workflow":
      return none;
  }
}

function containerLifetimeLengthsOf(
  lifetime: ContainerLifetime,
): readonly Finding[] {
  switch (lifetime.kind) {
    case "eventually":
      return lifetimeLengthOf(lifetime.after);
    case "always":
    case "never":
      return none;
  }
}

function lifetimeLengthOf(after: Duration): readonly Finding[] {
  switch (after.kind) {
    case "calendar":
      return [durationFindingOf("calendarLifetime", after, after.iso)];
    case "fixed":
    case "computed":
    case "invalid":
      return none;
  }
}

function durationFindingOf(
  name: DurationMessage,
  duration: Duration,
  text: string,
): Finding<DurationMessage> {
  return {
    name,
    code: "duration",
    pointer: duration.pointer,
    subject: null,
    details: [text],
    import: null,
  };
}
