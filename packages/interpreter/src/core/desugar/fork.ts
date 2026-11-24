import type * as ast from "../../syntax/index.js";
import {
  type Parallel,
  type TaskList,
  parallel,
  taskList,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { branchFlowOf } from "./data-flow.js";

export function forkBodyOf(
  task: ast.TaskCommon & ast.ForkTask,
  context: Context,
): Parallel {
  const id = context.termIdOf(task.pointer, "parallel");
  const branches = task.branches.tasks.map((branch) =>
    branchOf(branch, context),
  );
  const join = joinOf(task);

  return parallel({ id, branches, join });
}

function branchOf(branch: ast.Task, context: Context): TaskList {
  const id = context.termIdOf(branch.pointer, "list");
  const labels = new Map([[branch.name, 0]]);
  const listed = context.labelled(labels);
  const flow = branchFlowOf(branch, listed);

  return taskList({ id, pointer: branch.pointer, tasks: [flow] });
}

function joinOf(task: ast.ForkTask): Parallel["join"] {
  if (task.compete) {
    return "first";
  }

  return "all";
}
