import type { JsonObject } from "../../api/index.js";
import { instantTextOf } from "../time/index.js";
import type { TaskFacts, WorkflowFacts } from "./types.js";

export function taskDescriptorOf(task: TaskFacts): JsonObject {
  return {
    name: task.name,
    reference: task.reference,
    definition: task.definition,
    input: task.input,
    output: task.output,
    startedAt: dateTimeDescriptorOf(task.startedAt),
  };
}

export function workflowDescriptorOf(workflow: WorkflowFacts): JsonObject {
  return {
    id: workflow.id,
    definition: workflow.definition,
    input: workflow.input,
    startedAt: dateTimeDescriptorOf(workflow.startedAt),
  };
}

function dateTimeDescriptorOf(epochMilliseconds: number): JsonObject {
  const exactSeconds = epochMilliseconds / 1000;
  const seconds = Math.floor(exactSeconds);

  return {
    iso8601: instantTextOf(epochMilliseconds),
    epoch: { seconds, milliseconds: epochMilliseconds },
  };
}
