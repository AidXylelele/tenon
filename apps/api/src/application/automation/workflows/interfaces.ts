import type { Phase } from "../../../domain/automation/instances/enums.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type {
  WorkflowRefusal,
  WorkflowStatus,
} from "../../../domain/automation/workflows/enums.js";
import type {
  ImportTexts,
  ScheduleSpec,
} from "../../../domain/automation/workflows/interfaces.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Person } from "../../identity/users/interfaces.js";
import type { Missing } from "../enums.js";
import type { DefinitionRefusal } from "./enums.js";

export interface DefinitionProblem {
  readonly code: string;
  readonly pointer: string;
  readonly detail: string;
  readonly line: number | null;
  readonly column: number | null;
}

export type DefinitionFailure =
  readonly DefinitionProblem[] | DefinitionRefusal;

export type PublishFailure = DefinitionFailure | WorkflowRefusal;

export type DefinitionSource = JsonObject | string;

export interface CheckDefinitionCommand {
  readonly document: JsonObject;
  readonly publisherId: string;
}

export interface PublishedVersion {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly created: boolean;
}

export type CheckResult = Result<void, PublishFailure>;

export interface ArchiveWorkflowCommand {
  readonly name: WorkflowName;
}

export type ArchiveResult = Result<void, WorkflowRefusal | Missing>;

export interface TurnWorkflowCommand {
  readonly name: WorkflowName;
}

export type TurnResult = Result<void, WorkflowRefusal | Missing>;

export interface LastRun {
  readonly id: string;
  readonly phase: Phase;
  readonly createdAt: Date;
}

export interface WeekRuns {
  readonly runs: number;
  readonly failed: number;
}

export interface WorkflowSummary {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly status: WorkflowStatus;
  readonly on: boolean;
  readonly currentVersion: string | null;
  readonly schedule: ScheduleSpec | null;
  readonly week: WeekRuns;
  readonly lastRun: LastRun | null;
}

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
  readonly search: string | null;
  readonly limit: number;
}

export interface VersionSummary {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly current: boolean;
  readonly publishedBy: Person;
  readonly publishedAt: Date;
  readonly runs: number;
}

export interface VersionSource {
  readonly source: string | null;
}

export interface VersionIdentity {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
}

export interface VersionProgram {
  readonly versionId: string;
  readonly digest: string;
  readonly document: JsonObject;
  readonly imports: ImportTexts;
  readonly secrets: readonly string[];
}
