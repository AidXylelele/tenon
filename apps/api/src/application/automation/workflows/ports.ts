import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckedDefinition } from '../../../domain/automation/workflows/checked-definition.js';
import type { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
import type { Publication } from '../../../domain/automation/workflows/interfaces.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import type { Result } from '../../../domain/result.js';
import type { Missing } from '../enums.js';

// The first problem of a document the runtime refuses: where it is and what is wrong.
export interface DefinitionProblem {
  readonly pointer: string;
  readonly detail: string;
}

export type PublishFailure = DefinitionProblem | WorkflowRefusal;

export interface PublishVersionCommand {
  readonly document: JsonObject;
  readonly publisherId: string;
}

// What publishing would do: the workflow, new or found, and the version it would publish.
export interface PreparedPublication {
  readonly workflow: Workflow;
  readonly publication: Publication;
}

export type PublishResult = Result<PreparedPublication, PublishFailure>;

export interface ArchiveWorkflowCommand {
  readonly name: WorkflowName;
}

export type ArchiveResult = Result<void, Missing>;

export abstract class DefinitionChecker {
  // The definition the runtime can run, or the document's first problem (FR-002).
  abstract check(
    document: JsonObject,
  ): Promise<Result<CheckedDefinition, DefinitionProblem>>;
}

export abstract class WorkflowRepository {
  abstract findByName(name: WorkflowName): Promise<Workflow | null>;
  abstract findById(id: string): Promise<Workflow | null>;
  abstract save(workflow: Workflow): Promise<void>;
}

export abstract class WorkflowVersionRepository {
  abstract find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null>;
  abstract findById(id: string): Promise<WorkflowVersion | null>;
  // The version named, or the workflow's current version when none is named.
  abstract findToRun(
    name: WorkflowName,
    semver: string | null,
  ): Promise<WorkflowVersion | null>;
  // The current versions of the workflows that are on whose `schedule.on` takes events of
  // this type.
  abstract findStartedOn(type: string): Promise<WorkflowVersion[]>;
  // Inserts a version once: the same version again is a no-op.
  abstract add(version: WorkflowVersion): Promise<void>;
}
