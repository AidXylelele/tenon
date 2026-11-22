import type { ReturnMode } from "../../standard/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Decoder,
  type Perform,
  type ProcessDecoder,
  type ProcessTemplate,
  type WorkflowDecoder,
  type WorkflowTemplate,
  inputDecoder,
  perform,
  processDecoder,
  processTemplate,
  workflowDecoder,
  workflowTemplate,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { hostProcessOf, workflowInputOf } from "./effects/index.js";

export function runBodyOf(
  task: ast.TaskCommon & ast.RunTask,
  context: Context,
): Perform {
  const id = context.termIdOf(task.pointer, "perform");
  const effect = runRequestOf(task, context);
  const decoder = runDecoderOf(task, effect);

  return perform({ id, effect, decoder });
}

function runRequestOf(
  task: ast.RunTask,
  context: Context,
): ProcessTemplate | WorkflowTemplate {
  const process = task.process;

  switch (process.kind) {
    case "container":
    case "script":
    case "shell": {
      const hosted = hostProcessOf(process, context);
      return processTemplate({ process: hosted, await: task.await });
    }
    case "workflow": {
      const input = workflowInputOf(process, context);
      return workflowTemplate({
        namespace: process.namespace,
        name: process.name,
        version: process.version,
        input,
        await: task.await,
      });
    }
  }
}

function runDecoderOf(
  task: ast.RunTask,
  request: ProcessTemplate | WorkflowTemplate,
): Decoder {
  if (!task.await) {
    return inputDecoder({ awaits: request.kind });
  }

  return awaitedDecoderOf(request, task.return);
}

function awaitedDecoderOf(
  request: ProcessTemplate | WorkflowTemplate,
  mode: ReturnMode,
): ProcessDecoder | WorkflowDecoder {
  switch (request.kind) {
    case "process":
      return processDecoder({ return: mode });
    case "workflow":
      return workflowDecoder({ return: mode });
  }
}
