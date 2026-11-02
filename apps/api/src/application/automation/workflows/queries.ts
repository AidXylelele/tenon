import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { DocumentFormat } from '../../../domain/automation/workflows/enums.js';

export interface WorkflowSummary {
  readonly namespace: string;
  readonly name: string;
  readonly isOn: boolean;
  readonly currentVersion: string | null;
}

export interface WorkflowPage {
  readonly items: readonly WorkflowSummary[];
  readonly next: string | null;
}

export interface PageRequest {
  readonly cursor: string | null;
  readonly limit: number;
}

export interface VersionSummary {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly current: boolean;
  readonly publishedBy: string;
  readonly publishedAt: Date;
}

export interface VersionDocument {
  readonly format: DocumentFormat;
  readonly text: string;
}

export abstract class WorkflowQueries {
  abstract list(page: PageRequest): Promise<WorkflowPage>;
  abstract get(name: WorkflowName): Promise<WorkflowSummary | null>;
  abstract versions(name: WorkflowName): Promise<readonly VersionSummary[]>;
  abstract document(
    name: WorkflowName,
    version: string,
  ): Promise<VersionDocument | null>;
  abstract documentOf(versionId: string): Promise<VersionDocument | null>;
}
