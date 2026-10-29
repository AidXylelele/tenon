import type { DocumentReading } from '../../../domain/automation/language/document-reading.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { DocumentFormat } from '../../../domain/automation/workflows/interfaces.js';
import type { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';

export interface CheckDocumentQuery {
  readonly format: DocumentFormat;
  readonly text: string;
}

export interface PublishVersionCommand {
  readonly format: DocumentFormat;
  readonly text: string;
  readonly publisherId: string;
}

export interface PublishedVersionResult {
  readonly version: WorkflowVersion;
  readonly created: boolean;
  readonly current: boolean;
}

export abstract class DocumentReader {
  abstract read(source: SourceDocument): DocumentReading;
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
  abstract add(version: WorkflowVersion): Promise<void>;
}
