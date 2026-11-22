import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type {
  VersionIdentity,
  VersionProgram,
  VersionSource,
  VersionSummary,
  WorkflowPage,
  WorkflowPageRequest,
  WorkflowSummary,
} from "./interfaces.js";

export abstract class WorkflowQueries {
  abstract list(page: WorkflowPageRequest): Promise<WorkflowPage>;
  abstract get(name: WorkflowName): Promise<WorkflowSummary | null>;
  abstract version(
    name: WorkflowName,
    version: string,
  ): Promise<VersionSummary | null>;
  abstract versions(
    name: WorkflowName,
  ): Promise<readonly VersionSummary[] | null>;
  abstract document(
    name: WorkflowName,
    version: string,
  ): Promise<JsonObject | null>;
  abstract source(
    name: WorkflowName,
    version: string,
  ): Promise<VersionSource | null>;
  abstract program(
    name: WorkflowName,
    version: string,
  ): Promise<VersionProgram | null>;
  abstract programById(versionId: string): Promise<VersionProgram | null>;
  abstract identityById(versionId: string): Promise<VersionIdentity | null>;
}
