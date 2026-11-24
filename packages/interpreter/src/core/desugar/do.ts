import { InterpreterError } from "../../runtime/index.js";
import type * as ast from "../../syntax/index.js";
import { type TaskList, taskList } from "../forms/index.js";
import type { Context } from "./context.js";
import { taskFlowOf } from "./data-flow.js";

const noLists: readonly TaskList[] = [];

export function taskListOf(list: ast.TaskList, context: Context): TaskList {
  const labels = context.model.symbols.labels.get(list.pointer);

  if (labels === undefined) {
    throw new InterpreterError(
      `The task list at '${list.pointer}' has no label table.`,
    );
  }

  const listed = context.labelled(labels);
  const tasks = list.tasks.map((task) => taskFlowOf(task, listed));
  const id = context.termIdOf(list.pointer, "list");

  return taskList({ id, pointer: list.pointer, tasks });
}

export function taskListsOf(
  list: ast.TaskList | null,
  context: Context,
): readonly TaskList[] {
  if (list === null) {
    return noLists;
  }

  const listed = taskListOf(list, context);
  return [listed];
}
