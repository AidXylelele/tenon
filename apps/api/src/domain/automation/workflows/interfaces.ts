import type { Definition } from '../language/definition.js';
import type { DocumentFormat } from './enums.js';
import type { SourceDocument } from './source-document.js';
import type { Workflow } from './workflow.js';

export interface SourceDocumentProps {
  readonly format: DocumentFormat;
  readonly text: string;
  readonly fingerprint: string;
}

export interface WorkflowProps {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly isOn: boolean;
  readonly currentVersionId: string | null;
  readonly version: number;
}

export interface WorkflowVersionProps {
  readonly id: string;
  readonly workflowId: string;
  readonly semver: string;
  readonly dslVersion: string;
  readonly source: SourceDocument;
  readonly publisherId: string;
  readonly publishedAt: Date;
}

export interface NewWorkflowVersion {
  readonly workflow: Workflow;
  readonly definition: Definition;
  readonly source: SourceDocument;
  readonly publisherId: string;
  readonly now: Date;
}
