import type * as ast from "../../syntax/index.js";
import { type Perform, perform, sentDecoder } from "../forms/index.js";
import type { Context } from "./context.js";
import { emitTemplateOf } from "./effects/index.js";

export function emitBodyOf(
  task: ast.TaskCommon & ast.EmitTask,
  context: Context,
): Perform {
  const id = context.termIdOf(task.pointer, "perform");
  const effect = emitTemplateOf(task.event, context);
  const decoder = sentDecoder({ awaits: effect.kind });

  return perform({ id, effect, decoder });
}
