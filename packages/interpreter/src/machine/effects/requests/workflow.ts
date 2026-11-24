import type { WorkflowRequest } from "../../../api/index.js";
import type { WorkflowTemplate } from "../../../core/index.js";
import type { Building } from "./building.js";
import { valueOf } from "./shapes.js";

export function workflowRequestOf(
  workflow: WorkflowTemplate,
  building: Building,
): WorkflowRequest {
  const input = valueOf(workflow.input, building);

  return {
    kind: "workflow",
    namespace: workflow.namespace,
    name: workflow.name,
    version: workflow.version,
    input,
    await: workflow.await,
  };
}
