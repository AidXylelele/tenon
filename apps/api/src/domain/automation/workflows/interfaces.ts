import type { InstanceRefusal, TriggerKind } from '../instances/enums.js';
import type { WorkflowInstance } from '../instances/workflow-instance.js';
import type { JsonObject, JsonValue } from '../json.js';
import type { CheckedDefinition } from './checked-definition.js';
import type { WorkflowRefusal, WorkflowStatus } from './enums.js';
import type { WorkflowName } from './workflow-name.js';
import type { WorkflowVersion } from './workflow-version.js';

export interface WorkflowProps {
  readonly id: string;
  readonly name: WorkflowName;
  readonly status: WorkflowStatus;
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
  readonly publisherId: string;
  readonly publishedAt: Date;
}

export interface CheckedDefinitionProps {
  readonly name: WorkflowName;
  readonly version: string;
  readonly dsl: string;
  readonly fingerprint: string;
  readonly document: JsonObject;
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
