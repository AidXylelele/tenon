import type { Task, TaskCommon, TaskList } from "../ast/index.js";
import { bodyOf } from "./bodies.js";
import { thenOf } from "./directives.js";
import { timeoutOf } from "./errors.js";
import { itemsOf, objectAt, optionalAt, soleFieldOf } from "./parts.js";
import { exportOf, inputOf, outputOf } from "./transformations.js";
import type { Part } from "./types.js";
import { expressionOf } from "./values.js";

export function taskOf(part: Part, name: string): Task {
  const common = commonOf(part, name);
  const body = bodyOf(part);

  return { ...common, ...body };
}

export function taskListOf(list: Part): TaskList {
  const tasks = itemsOf(list).map(namedTaskOf);
  return { pointer: list.pointer, tasks };
}

function namedTaskOf(item: Part): Task {
  const { name, part } = soleFieldOf(item);
  return taskOf(part, name);
}

function commonOf(task: Part, name: string): TaskCommon {
  const condition = optionalAt(task, "if", expressionOf);
  const input = inputOf(task);
  const output = outputOf(task);
  const exported = exportOf(task);
  const timeout = optionalAt(task, "timeout", timeoutOf);
  const then = thenOf(task);
  const metadata = objectAt(task, "metadata");

  return {
    pointer: task.pointer,
    name,
    if: condition,
    input,
    output,
    export: exported,
    timeout,
    then,
    metadata,
  };
}
