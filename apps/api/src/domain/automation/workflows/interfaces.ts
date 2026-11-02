import type { Definition } from '../language/definition.js';
import type { DslVersion } from '../language/enums.js';
import type { WorkflowName } from '../language/workflow-name.js';
import type { DocumentFormat } from './enums.js';
import type { SourceDocument } from './source-document.js';
import type { Workflow } from './workflow.js';
import type { WorkflowVersion } from './workflow-version.js';

export interface SourceDocumentProps {
  readonly format: DocumentFormat;
  readonly text: string;
}

export interface WorkflowProps {
  readonly id: string;
  readonly name: WorkflowName;
  readonly isOn: boolean;
  readonly currentVersionId: string | null;
  readonly version: number;
}

export interface WorkflowVersionProps {
  readonly id: string;
  readonly workflowId: string;
  readonly semver: string;
  readonly dslVersion: DslVersion;
  readonly source: SourceDocument;
  readonly publisherId: string;
  readonly publishedAt: Date;
}

export interface NewWorkflowVersion {
  readonly definition: Definition;
  readonly source: SourceDocument;
  readonly publisherId: string;
  readonly now: Date;
}

export interface VersionReferenceProps {
  readonly versionId: string | null;
  readonly workflowId: string | null;
  readonly semver: string | null;
}

export interface RunnableVersionProps {
  readonly workflow: Workflow;
  readonly version: WorkflowVersion;
}
