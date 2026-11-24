import type * as ast from "../../syntax/index.js";
import { type Perform, inputDecoder, perform } from "../forms/index.js";
import type { Context } from "./context.js";
import { timerTemplateOf } from "./effects/index.js";

export function waitBodyOf(
  task: ast.TaskCommon & ast.WaitTask,
  context: Context,
): Perform {
  const id = context.termIdOf(task.pointer, "perform");
  const effect = timerTemplateOf(task.wait, context);
  const decoder = inputDecoder({ awaits: effect.kind });

  return perform({ id, effect, decoder });
}
