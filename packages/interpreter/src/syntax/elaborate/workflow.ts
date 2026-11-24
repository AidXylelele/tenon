import { defaults, expressionModes, readModes } from "../../standard/index.js";
import type {
  AfterSchedule,
  CronSchedule,
  DocumentHeader,
  Evaluate,
  EventSchedule,
  EverySchedule,
  Schedule,
  Workflow,
} from "../ast/index.js";
import { useOf } from "./components.js";
import { durationOf } from "./durations.js";
import { timeoutOf } from "./errors.js";
import { strategyOf } from "./events.js";
import { fieldOf, objectFieldOf, optionalAt, requiredAt } from "./parts.js";
import { optionalMemberAt, textOf } from "./scalars.js";
import { taskListOf } from "./tasks.js";
import { inputOf, outputOf } from "./transformations.js";
import type { Part } from "./types.js";

const unscheduled: readonly Schedule[] = [];

export function workflowOf(root: Part): Workflow {
  const document = requiredAt(root, "document", documentOf);
  const input = inputOf(root);
  const use = useOf(root);
  const tasks = requiredAt(root, "do", taskListOf);
  const timeout = optionalAt(root, "timeout", timeoutOf);
  const output = outputOf(root);
  const schedules = schedulesOf(root);
  const evaluate = evaluateOf(root);

  return {
    pointer: root.pointer,
    document,
    input,
    use,
    do: tasks,
    timeout,
    output,
    schedules,
    evaluate,
  };
}

export function evaluateOf(root: Part): Evaluate {
  const evaluate = objectFieldOf(root, "evaluate");
  const language =
    optionalAt(evaluate, "language", textOf) ?? defaults.expressionLanguage;
  const mode =
    optionalMemberAt(evaluate, "mode", expressionModes) ??
    defaults.expressionMode;

  return { pointer: evaluate.pointer, language, mode };
}

function documentOf(part: Part): DocumentHeader {
  const dsl = requiredAt(part, "dsl", textOf);
  const namespace = requiredAt(part, "namespace", textOf);
  const name = requiredAt(part, "name", textOf);
  const version = requiredAt(part, "version", textOf);
  const title = optionalAt(part, "title", textOf);
  const summary = optionalAt(part, "summary", textOf);

  return {
    pointer: part.pointer,
    dsl,
    namespace,
    name,
    version,
    title,
    summary,
  };
}

function schedulesOf(root: Part): readonly Schedule[] {
  const schedule = fieldOf(root, "schedule");

  if (schedule === null) {
    return unscheduled;
  }

  const every = optionalAt(schedule, "every", everyOf);
  const cron = optionalAt(schedule, "cron", cronOf);
  const after = optionalAt(schedule, "after", afterOf);
  const on = eventScheduleOf(schedule);
  const kinds = [every, cron, after, on];

  return kinds.filter((kind) => kind !== null);
}

function everyOf(part: Part): EverySchedule {
  const interval = durationOf(part);
  return { kind: "every", pointer: part.pointer, interval };
}

function cronOf(part: Part): CronSchedule {
  const cron = textOf(part);
  return { kind: "cron", pointer: part.pointer, cron };
}

function afterOf(part: Part): AfterSchedule {
  const delay = durationOf(part);
  return { kind: "after", pointer: part.pointer, delay };
}

function eventScheduleOf(schedule: Part): EventSchedule | null {
  const on = fieldOf(schedule, "on");

  if (on === null) {
    return null;
  }

  const strategy = strategyOf(on);
  const read =
    optionalMemberAt(schedule, "read", readModes) ?? defaults.scheduleRead;

  return { kind: "on", pointer: on.pointer, strategy, read };
}
