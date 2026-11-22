import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import type { Workflow } from "../../../domain/automation/workflows/workflow.js";
import type { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import type { DefinitionProblem } from "../workflows/interfaces.js";

export abstract class WorkflowSchedules {
  abstract check(
    definition: CheckedDefinition,
  ): Promise<DefinitionProblem | null>;
  abstract apply(workflow: Workflow, version: WorkflowVersion): Promise<void>;
  abstract clear(workflow: Workflow): Promise<void>;
  abstract continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void>;
}
