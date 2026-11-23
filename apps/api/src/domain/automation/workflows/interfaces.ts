import type { InstanceRefusal, TriggerKind } from "../instances/enums.js";
import type { WorkflowInstance } from "../instances/workflow-instance.js";
import type { JsonObject, JsonValue } from "../interfaces.js";
import type { CheckedDefinition } from "./checked-definition.js";
import type {
  ScheduleKind,
  WorkflowEventKind,
  WorkflowRefusal,
  WorkflowStatus,
} from "./enums.js";
import type { Schedule } from "./schedule.js";
import type { WorkflowName } from "./workflow-name.js";
import type { WorkflowVersion } from "./workflow-version.js";

export type ScheduleSpec =
  | { readonly kind: ScheduleKind.Every; readonly interval: number }
  | { readonly kind: ScheduleKind.Cron; readonly cron: string }
  | { readonly kind: ScheduleKind.After; readonly delay: number }
  | {
      readonly kind: ScheduleKind.On;
      readonly stream: string;
      readonly types: readonly string[];
    };

export interface PassedSlots {
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

export interface WorkflowProps {
  readonly id: string;
  readonly name: WorkflowName;
  readonly status: WorkflowStatus;
  readonly on: boolean;
  readonly currentVersionId: string | null;
  readonly archivedAt: Date | null;
  readonly arming: number;
  readonly scheduledSince: Date | null;
  readonly version: number;
  readonly versions: readonly WorkflowVersion[];
}

export interface WorkflowVersionProps {
  readonly id: string;
  readonly semver: string;
  readonly dsl: string;
  readonly digest: string;
  readonly programFingerprint: string;
  readonly schedule: Schedule | null;
  readonly secrets: readonly string[];
  readonly publisherId: string;
  readonly publishedAt: Date;
  readonly test: boolean;
}

export type ImportTexts = Readonly<Record<string, string>>;

export interface CheckedDefinitionProps {
  readonly name: WorkflowName;
  readonly version: string;
  readonly dsl: string;
  readonly digest: string;
  readonly document: JsonObject;
  readonly imports: ImportTexts;
  readonly programFingerprint: string;
  readonly schedule: Schedule | null;
  readonly secrets: readonly string[];
}

export interface NewPublication {
  readonly definition: CheckedDefinition;
  readonly source: string | null;
  readonly publisherId: string;
  readonly now: Date;
}

export interface Publication {
  readonly version: WorkflowVersion;
  readonly created: boolean;
}

export interface VersionPublication {
  readonly version: WorkflowVersion;
  readonly document: JsonObject;
  readonly imports: ImportTexts;
  readonly source: string | null;
}

export interface NewInstance {
  readonly instanceId: string | null;
  readonly version: WorkflowVersion;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
  readonly starterId: string | null;
  readonly origin: WorkflowInstance | null;
  readonly originEffectId: string | null;
  readonly now: Date;
}

export interface ChildStart {
  readonly instanceId: string | null;
  readonly version: string | null;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
  readonly parent: WorkflowInstance;
  readonly effectId: string;
  readonly now: Date;
}

export interface InstanceRestart {
  readonly previous: WorkflowInstance;
  readonly version: WorkflowVersion;
  readonly starterId: string;
  readonly now: Date;
}

export type StartRefusal = WorkflowRefusal | InstanceRefusal;

export interface ScheduledStart {
  readonly instanceId: string | null;
  readonly version: WorkflowVersion;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
  readonly chainRunning: boolean;
  readonly lifecycleOf: string | null;
  readonly now: Date;
}

export interface ScheduleArmed {
  readonly kind: WorkflowEventKind.ScheduleArmed;
  readonly workflowId: string;
  readonly arming: number;
  readonly at: number;
}

export interface ScheduleFired {
  readonly kind: WorkflowEventKind.ScheduleFired;
  readonly workflowId: string;
  readonly at: number;
}

export type WorkflowEvent = ScheduleArmed | ScheduleFired;

export interface ScheduleFire {
  readonly arming: number;
  readonly at: number;
  readonly now: Date;
}

export interface FiredStart {
  readonly instanceId: string;
  readonly chainRunning: boolean;
  readonly now: Date;
}
