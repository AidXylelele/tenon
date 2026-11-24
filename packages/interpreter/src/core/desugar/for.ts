import { iterationBindersOf } from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import { type Loop, loop } from "../forms/index.js";
import { binderFrameOf } from "../storage/index.js";
import { bindersOf } from "./binders.js";
import type { Context } from "./context.js";
import { taskListOf } from "./do.js";
import { conditionsOf } from "./expressions.js";
import { writtenTemplateOf } from "./templates.js";

export function forBodyOf(
  task: ast.TaskCommon & ast.ForTask,
  context: Context,
): Loop {
  const id = context.termIdOf(task.pointer, "loop");
  const items = writtenTemplateOf(task.in, context);
  const declared = iterationBindersOf(task.pointer, task.each, task.at);
  const binders = bindersOf(declared);
  const frame = binderFrameOf(binders);
  const iterating = context.extended(frame);
  const conditions = conditionsOf(task.while, iterating);
  const body = taskListOf(task.do, iterating);

  return loop({ id, items, binders, conditions, body });
}
