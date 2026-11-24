import type { Secret } from "../../../domain/automation/secrets/secret.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import type { Workflow } from "../../../domain/automation/workflows/workflow.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { DefinitionFailure, DefinitionSource } from "./interfaces.js";

export abstract class DefinitionCompiler {
  abstract compile(
    definition: DefinitionSource,
    secrets: readonly Secret[],
  ): Promise<Result<CheckedDefinition, DefinitionFailure>>;
}

export abstract class WorkflowEvents {
  abstract dispatch(workflow: Workflow): Promise<void>;
}

export abstract class WorkflowRepository {
  abstract findByName(name: WorkflowName): Promise<Workflow | null>;
  abstract findById(id: string): Promise<Workflow | null>;
  abstract save(workflow: Workflow): Promise<void>;
}
