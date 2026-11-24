import type * as ast from "../../syntax/index.js";
import { type Transform, transform } from "../forms/index.js";
import type { Context } from "./context.js";
import { writtenTemplateOf } from "./templates.js";

export function setBodyOf(
  task: ast.TaskCommon & ast.SetTask,
  context: Context,
): Transform {
  const id = context.termIdOf(task.pointer, "body");
  const value = writtenTemplateOf(task.set, context);

  return transform({ id, value });
}
