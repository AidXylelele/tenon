import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { StartRefusal } from '../../../domain/automation/workflows/interfaces.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { InstanceRefusal } from '../../../domain/automation/instances/enums.js';
import type { Result } from '../../../domain/result.js';
import type { Missing } from '../enums.js';
import type { TaskStatus } from './enums.js';

export interface StartInstanceCommand {
  readonly name: WorkflowName;
  // null: the workflow's current version.
  readonly version: string | null;
  readonly input: JsonValue;
  readonly starterId: string;
}

export type StartResult = Result<WorkflowInstance, StartRefusal | Missing>;

export interface InstanceCommand {
  readonly instanceId: string;
}

export interface RestartInstanceCommand {
  readonly instanceId: string;
  readonly starterId: string;
}

export type InstanceResult = Result<void, InstanceRefusal | Missing>;

// A task's execution as the progress view keeps it: started (running) or ended. `attempt`: which
// attempt of the task it is, each its own execution; `retryAt`: when the task runs again, for a
// fault a `try` retries.
export interface TaskRecord {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: JsonObject | null;
  readonly attempt: number;
  readonly retryAt: Date | null;
  readonly at: Date;
}

export interface RecordTaskCommand {
  readonly instanceId: string;
  readonly task: TaskRecord;
}

export interface EndInstanceCommand {
  readonly instanceId: string;
  readonly output: JsonValue;
  readonly error: JsonObject | null;
}

export abstract class WorkflowInstanceRepository {
  abstract find(id: string): Promise<WorkflowInstance | null>;
  // The children an instance awaits (its `run: workflow` tasks') that have not ended.
  abstract findAwaitedChildren(parentId: string): Promise<WorkflowInstance[]>;
  // Whether an instance the workflow's schedule started has not ended.
  abstract hasUnendedScheduled(workflowId: string): Promise<boolean>;
  abstract save(instance: WorkflowInstance): Promise<void>;
  abstract remove(instance: WorkflowInstance): Promise<void>;
}

// The engine that runs instances: an instance's run starts in the transaction that saves it.
export abstract class InstanceRuns {
  abstract start(instance: WorkflowInstance): Promise<void>;
}

// The progress view: what each task did, written as the runtime reports it.
export abstract class TaskProgress {
  abstract started(instanceId: string, task: TaskRecord): Promise<void>;
  abstract ended(instanceId: string, task: TaskRecord): Promise<void>;
  // The instance ended: its tasks still running end with it, as cancelled (FR-015).
  abstract cancelRunning(instanceId: string, at: Date): Promise<void>;
}
