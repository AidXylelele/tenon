import type { Definition } from '../../../domain/automation/language/definition.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { DocumentFormat } from '../../../domain/automation/workflows/enums.js';
import type { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import type { VersionReference } from '../../../domain/automation/workflows/version-reference.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';

export interface CheckDocumentQuery {
  readonly format: DocumentFormat;
  readonly text: string;
}

// What publishing would publish, and the version already published under its identity.
export interface CheckedDocument {
  readonly source: SourceDocument;
  readonly definition: Definition;
  readonly existing: WorkflowVersion | null;
}

export interface PublishVersionCommand {
  readonly format: DocumentFormat;
  readonly text: string;
  readonly publisherId: string;
}

export interface PublishedVersionResult {
  readonly workflow: Workflow;
  readonly version: WorkflowVersion;
  readonly created: boolean;
  readonly current: boolean;
}

export interface ConformanceStatement {
  readonly dsl: readonly string[];
  readonly tasks: readonly string[];
  readonly calls: readonly string[];
  readonly runs: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly authentications: readonly string[];
  readonly excluded: readonly string[];
  readonly contradictions: readonly string[];
}

export abstract class WorkflowRepository {
  abstract findByName(name: WorkflowName): Promise<Workflow | null>;
  abstract save(workflow: Workflow): Promise<void>;
}

export abstract class WorkflowVersionRepository {
  abstract find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null>;
  abstract findBy(reference: VersionReference): Promise<WorkflowVersion | null>;
  abstract add(version: WorkflowVersion): Promise<void>;
}
