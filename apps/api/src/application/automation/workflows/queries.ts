import type { JsonObject } from '../../../domain/automation/json.js';
import type { WorkflowStatus } from '../../../domain/automation/workflows/enums.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';

export interface WorkflowSummary {
  readonly namespace: string;
  readonly name: string;
  readonly status: WorkflowStatus;
  readonly on: boolean;
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
  readonly status: WorkflowStatus | null;
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

export abstract class WorkflowQueries {
  abstract list(page: WorkflowPageRequest): Promise<WorkflowPage>;
  abstract get(name: WorkflowName): Promise<WorkflowSummary | null>;
  abstract versions(
    name: WorkflowName,
  ): Promise<readonly VersionSummary[] | null>;
  abstract document(
    name: WorkflowName,
    version: string,
  ): Promise<JsonObject | null>;
}
