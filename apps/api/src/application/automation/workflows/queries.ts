import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { DocumentFormat } from '../../../domain/automation/workflows/enums.js';

export interface WorkflowSummary {
  readonly namespace: string;
  readonly name: string;
  readonly isOn: boolean;
  readonly currentVersion: string | null;
}

// The last workflow of a page, in the list's order.
export interface WorkflowPosition {
  readonly namespace: string;
  readonly name: string;
}

export interface WorkflowPage {
  readonly items: readonly WorkflowSummary[];
  readonly next: WorkflowPosition | null;
}

export interface WorkflowPageRequest {
  readonly after: WorkflowPosition | null;
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
  abstract list(page: WorkflowPageRequest): Promise<WorkflowPage>;
  abstract get(name: WorkflowName): Promise<WorkflowSummary | null>;
  abstract versions(name: WorkflowName): Promise<readonly VersionSummary[]>;
  abstract document(
    name: WorkflowName,
    version: string,
  ): Promise<VersionDocument | null>;
  abstract documentOf(versionId: string): Promise<VersionDocument | null>;
}
