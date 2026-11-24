import type { JsonValue } from "../../api/index.js";
import { defaults } from "../../standard/index.js";
import type { Task, Workflow } from "../ast/index.js";
import { taskOf } from "./tasks.js";
import type { Part } from "./types.js";
import { evaluateOf, workflowOf } from "./workflow.js";

const root = "";

export function elaborate(document: JsonValue): Workflow {
  const unread: Part = {
    value: document,
    pointer: root,
    mode: defaults.expressionMode,
  };
  const evaluate = evaluateOf(unread);
  const workflow: Part = {
    value: document,
    pointer: root,
    mode: evaluate.mode,
  };

  return workflowOf(workflow);
}

export function elaborateTask(
  name: string,
  definition: JsonValue,
  pointer: string,
): Task {
  const task: Part = {
    value: definition,
    pointer,
    mode: defaults.expressionMode,
  };

  return taskOf(task, name);
}
