import type { Definition } from '../language/definition.js';
import type { DslVersion } from '../language/enums.js';
import type { WorkflowName } from '../language/workflow-name.js';
import type { DocumentFormat } from './enums.js';
import type { SourceDocument } from './source-document.js';

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
