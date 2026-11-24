import type { Schedule, Workflow } from "../../syntax/index.js";
import { useOccurrencesOf } from "./components.js";
import { at, outermost } from "./contexts.js";
import {
  durationOccurrencesOf,
  inputOccurrencesOf,
  outputOccurrencesOf,
} from "./data.js";
import { timeoutOccurrencesOf } from "./errors.js";
import { strategyOccurrencesOf } from "./events.js";
import { taskListOccurrencesOf } from "./tasks.js";
import type { Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function workflowOccurrencesOf(
  workflow: Workflow,
): readonly Occurrence[] {
  const input = at(outermost, "workflowInput");
  const timeout = at(outermost, "workflowTimeout");
  const output = at(outermost, "workflowOutput");

  return [
    ...inputOccurrencesOf(workflow.input, input),
    ...useOccurrencesOf(workflow.use),
    ...taskListOccurrencesOf(workflow.do, "sequence", outermost),
    ...timeoutOccurrencesOf(workflow.timeout, timeout),
    ...outputOccurrencesOf(workflow.output, output),
    ...workflow.schedules.flatMap(scheduleOccurrencesOf),
  ];
}

function scheduleOccurrencesOf(schedule: Schedule): readonly Occurrence[] {
  const timing = at(outermost, "scheduleTiming");
  const trigger = at(outermost, "scheduleOn");

  switch (schedule.kind) {
    case "every":
      return durationOccurrencesOf(schedule.interval, timing);
    case "cron":
      return none;
    case "after":
      return durationOccurrencesOf(schedule.delay, timing);
    case "on":
      return strategyOccurrencesOf(schedule.strategy, trigger);
  }
}
