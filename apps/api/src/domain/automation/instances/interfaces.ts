import type { Definition } from '../language/definition.js';
import type {
  JsonObject,
  JsonValue,
  DetachedWorkflow,
  ProcessRun,
  TaskStart,
} from '../language/interfaces.js';
import type { JsonPointer } from '../language/json-pointer.js';
import type { Phase } from '../language/phase.js';
import type { TaskProgress } from '../language/stages/task-progress.js';
import type { TaskEnding } from '../language/task-ending.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type { WorkflowName } from '../language/workflow-name.js';
import type { WorkflowTarget } from '../language/workflow-target.js';
import type { Workflow } from '../workflows/workflow.js';
import type { WorkflowVersion } from '../workflows/workflow-version.js';
import type { ProcessDetached } from './domain-events/process-detached.js';
import type { WorkflowDetached } from './domain-events/workflow-detached.js';
import type { InstanceProgressKind } from './enums.js';
import type { LifecycleEventType } from './lifecycle-event-type.js';
import type { ParentOrigin } from './origins/parent-origin.js';
import type { UserOrigin } from './origins/user-origin.js';
import type { TaskInstance } from './task-instance.js';

export type Origin = UserOrigin | ParentOrigin;

export type InstanceEvent = ProcessDetached | WorkflowDetached;

export interface ProcessDetachedProps {
  readonly instanceId: string;
  readonly taskInstanceId: string;
  readonly run: ProcessRun;
}

export interface WorkflowDetachedProps {
  readonly instanceId: string;
  readonly taskInstanceId: string;
  readonly subWorkflowId: string;
  readonly detached: DetachedWorkflow;
}

export interface LifecycleSubject {
  readonly instanceId: string;
  readonly workflowId: string;
  readonly workflow: WorkflowName;
  readonly semver: string;
}

export interface LifecycleOutput {
  readonly value: JsonValue;
}

export interface LifecycleNotice {
  readonly type: LifecycleEventType;
  readonly task: JsonPointer | null;
  readonly time: Date;
  readonly error: WorkflowError | null;
  readonly output: LifecycleOutput | null;
}

// A notice about a task, before it names the task.
export interface TaskNotice {
  readonly type: LifecycleEventType;
  readonly time: Date;
  readonly error: WorkflowError | null;
  readonly output: LifecycleOutput | null;
}

export interface LifecycleEventProps extends LifecycleNotice {
  readonly subject: LifecycleSubject;
  readonly sequence: number;
  readonly acceptedAt: Date;
}

export interface TaskInstanceProps {
  readonly id: string;
  readonly execution: number;
  readonly reference: JsonPointer;
  readonly name: string;
  readonly parentId: string | null;
  readonly cancelled: boolean;
  readonly rawInput: JsonValue;
  readonly variables: JsonObject;
  readonly retries: number;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly progress: TaskProgress;
}

export interface NewTaskInstance {
  readonly id: string;
  readonly execution: number;
  readonly parentId: string | null;
  readonly name: string;
  readonly start: TaskStart;
  readonly now: Date;
}

export interface TaskChange {
  readonly starts: readonly TaskStart[];
  readonly entered: boolean;
  readonly retried: boolean;
  readonly ending: TaskEnding | null;
}

export interface TaskFollowUp {
  readonly task: TaskInstance;
  readonly change: TaskChange;
}

export interface WorkflowInstanceProps {
  readonly id: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly workflow: WorkflowName;
  readonly semver: string;
  readonly phase: Phase;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: WorkflowError | null;
  readonly context: JsonValue;
  readonly origin: Origin;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly sequence: number;
  readonly executions: number;
  // The rounds begun: a round records its results only while it is the latest.
  readonly rounds: number;
  readonly tasks: readonly TaskInstance[];
  readonly version: number;
}

export interface NewWorkflowInstance {
  readonly id: string;
  readonly workflow: Workflow;
  readonly version: WorkflowVersion;
  readonly input: JsonValue | undefined;
  readonly origin: Origin;
  readonly now: Date;
}

export interface InstanceIdentity {
  readonly userId: string;
  readonly workflowId: string;
  readonly key: string | null;
}

export interface RequestedSubWorkflow {
  readonly taskId: string;
  readonly instanceId: string;
  readonly target: WorkflowTarget;
  readonly input: JsonValue;
  readonly awaited: boolean;
}

export interface NewSubWorkflowInstance {
  readonly id: string;
  readonly parentId: string;
  readonly taskId: string;
  readonly workflow: Workflow;
  readonly version: WorkflowVersion;
  readonly input: JsonValue;
  readonly now: Date;
}

export interface InstanceProgress {
  readonly kind: InstanceProgressKind;
  readonly wakeAt: Date | null;
  readonly subWorkflows: readonly string[];
}

export interface RoundContext {
  readonly definition: Definition;
  readonly runtime: JsonObject;
  readonly now: Date;
}
