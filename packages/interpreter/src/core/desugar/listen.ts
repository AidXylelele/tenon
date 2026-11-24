import type * as ast from "../../syntax/index.js";
import {
  type Stream,
  listenSource,
  stopConsumption,
  stream,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { iteratorsOf } from "./iterator.js";
import { strategyTemplateOf } from "./strategies.js";

export function listenBodyOf(
  task: ast.TaskCommon & ast.ListenTask,
  context: Context,
): Stream {
  const id = context.termIdOf(task.pointer, "stream");
  const strategy = strategyTemplateOf(task.to, context);
  const source = listenSource({ strategy, read: task.read });
  const iterators = iteratorsOf(task.foreach, context);

  return stream({ id, source, stop: stopConsumption, iterators });
}
