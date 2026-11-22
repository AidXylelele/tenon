import type {
  Catch,
  ForTask,
  ListenTask,
  SwitchCase,
  Task,
  TaskCommon,
  TaskList,
  TryTask,
} from "../../syntax/index.js";
import { callOccurrencesOf } from "./calls.js";
import {
  at,
  handlingBindersOf,
  inTask,
  iterationBindersOf,
  within,
} from "./contexts.js";
import {
  durationOccurrencesOf,
  inputOccurrencesOf,
  outputOccurrencesOf,
  templateOccurrencesOf,
} from "./data.js";
import {
  errorOccurrencesOf,
  retryOccurrencesOf,
  timeoutOccurrencesOf,
} from "./errors.js";
import {
  eventOccurrencesOf,
  iteratorOccurrencesOf,
  strategyOccurrencesOf,
} from "./events.js";
import { processOccurrencesOf } from "./processes.js";
import type { Context, ListRole, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function taskListOccurrencesOf(
  list: TaskList | null,
  role: ListRole,
  context: Context,
): readonly Occurrence[] {
  if (list === null) {
    return none;
  }

  const tasks = list.tasks.flatMap((task) => taskOccurrencesOf(task, context));
  return [{ kind: "list", list, role, context }, ...tasks];
}

export function taskOccurrencesOf(
  task: Task,
  context: Context,
): readonly Occurrence[] {
  const inside = inTask(context, task);
  const condition = at(inside, "taskIf");
  const input = at(inside, "taskInput");
  const timeout = at(inside, "taskTimeout");
  const body = at(inside, "taskBody");
  const output = at(inside, "taskOutput");
  const exported = at(inside, "taskExport");

  return [
    { kind: "task", task, context: inside },
    ...templateOccurrencesOf(task.if, condition),
    ...inputOccurrencesOf(task.input, input),
    ...timeoutOccurrencesOf(task.timeout, timeout),
    ...bodyOccurrencesOf(task, body),
    ...outputOccurrencesOf(task.output, output),
    ...outputOccurrencesOf(task.export, exported),
  ];
}

function bodyOccurrencesOf(task: Task, body: Context): readonly Occurrence[] {
  switch (task.kind) {
    case "call":
      return callOccurrencesOf(task, body);
    case "do":
      return taskListOccurrencesOf(task.do, "sequence", body);
    case "emit":
      return eventOccurrencesOf(task.event, body);
    case "for":
      return forOccurrencesOf(task, body);
    case "fork":
      return taskListOccurrencesOf(task.branches, "branches", body);
    case "listen":
      return listenOccurrencesOf(task, body);
    case "raise":
      return errorOccurrencesOf(task.error, body);
    case "run":
      return processOccurrencesOf(task.process, body);
    case "set":
      return templateOccurrencesOf(task.set, body);
    case "switch":
      return casesOccurrencesOf(task.switch, body);
    case "try":
      return tryOccurrencesOf(task, body);
    case "wait":
      return durationOccurrencesOf(task.wait, body);
  }
}

function forOccurrencesOf(
  task: TaskCommon & ForTask,
  context: Context,
): readonly Occurrence[] {
  const binders = iterationBindersOf(task.pointer, task.each, task.at);
  const each = within(context, binders);

  return [
    { kind: "binders", binders, context },
    ...templateOccurrencesOf(task.in, context),
    ...templateOccurrencesOf(task.while, each),
    ...taskListOccurrencesOf(task.do, "sequence", each),
  ];
}

function listenOccurrencesOf(
  task: ListenTask,
  context: Context,
): readonly Occurrence[] {
  return [
    ...strategyOccurrencesOf(task.to, context),
    ...iteratorOccurrencesOf(task.foreach, context),
  ];
}

function casesOccurrencesOf(
  cases: readonly SwitchCase[],
  context: Context,
): readonly Occurrence[] {
  return cases.flatMap((switchCase) =>
    templateOccurrencesOf(switchCase.when, context),
  );
}

function tryOccurrencesOf(
  task: TryTask,
  context: Context,
): readonly Occurrence[] {
  return [
    ...taskListOccurrencesOf(task.try, "sequence", context),
    ...catchOccurrencesOf(task.catch, context),
  ];
}

function catchOccurrencesOf(
  caught: Catch,
  context: Context,
): readonly Occurrence[] {
  const binders = handlingBindersOf(caught.pointer, caught.as);
  const handler = within(context, binders);

  return [
    { kind: "binders", binders, context },
    ...templateOccurrencesOf(caught.when, handler),
    ...templateOccurrencesOf(caught.exceptWhen, handler),
    ...retryOccurrencesOf(caught.retry, handler, context),
    ...taskListOccurrencesOf(caught.do, "sequence", handler),
  ];
}
