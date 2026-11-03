import type { InstanceRefusal, TriggerKind } from '../instances/enums.js';
import type { WorkflowInstance } from '../instances/workflow-instance.js';
import type { JsonObject, JsonValue } from '../json.js';
import type { CheckedDefinition } from './checked-definition.js';
import type {
  WorkflowEventKind,
  WorkflowRefusal,
  WorkflowStatus,
} from './enums.js';
import type { WorkflowName } from './workflow-name.js';
import type { WorkflowVersion } from './workflow-version.js';

export interface WorkflowProps {
  readonly id: string;
  readonly name: WorkflowName;
  readonly status: WorkflowStatus;
  // Whether the schedule of its current version starts instances (FR-006).
  readonly on: boolean;
  readonly currentVersionId: string | null;
  readonly archivedAt: Date | null;
  readonly version: number;
}

export interface WorkflowVersionProps {
  readonly id: string;
  readonly workflowId: string;
  readonly semver: string;
  readonly dsl: string;
  readonly fingerprint: string;
  readonly document: JsonObject;
  readonly eventTypes: readonly string[] | null;
  readonly publisherId: string;
  readonly publishedAt: Date;
}

export interface CheckedDefinitionProps {
  readonly name: WorkflowName;
  readonly version: string;
  readonly dsl: string;
  readonly fingerprint: string;
  readonly document: JsonObject;
  // The event types its schedule starts instances on: null when it starts on none, empty when
  // on events of any type.
  readonly eventTypes: readonly string[] | null;
}

// `existing`: the version already published under the definition's identity, if any.
export interface NewPublication {
  readonly definition: CheckedDefinition;
  readonly existing: WorkflowVersion | null;
  readonly publisherId: string;
  readonly now: Date;
}

export interface Publication {
  readonly version: WorkflowVersion;
  readonly created: boolean;
}

// `originId`: the instance this one comes from — its parent, or the one it restarts.
export interface NewInstance {
  readonly version: WorkflowVersion;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
  readonly starterId: string | null;
  readonly originId: string | null;
  readonly now: Date;
}

export interface InstanceRestart {
  readonly previous: WorkflowInstance;
  readonly version: WorkflowVersion;
  readonly starterId: string;
  readonly now: Date;
}

export type StartRefusal = WorkflowRefusal | InstanceRefusal;

// An instance the schedule starts: an occurrence names it, so a repeated occurrence is the
// same instance (null: a new one).
// `chained`: the occurrence is a link of an `after` chain; `chainRunning`: an instance the
// schedule started has not ended.
export interface ScheduledStart {
  readonly instanceId: string | null;
  readonly version: WorkflowVersion;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
  readonly chained: boolean;
  readonly chainRunning: boolean;
  readonly now: Date;
}

export interface WorkflowEvent {
  readonly kind: WorkflowEventKind;
  readonly workflowId: string;
}
