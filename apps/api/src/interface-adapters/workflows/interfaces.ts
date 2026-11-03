import type { TaskStatus } from '../../application/automation/instances/enums.js';
import type { RunDirective } from '../../domain/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../domain/automation/json.js';
import type { RunOutcomeKind, VerdictKind } from './enums.js';

// The identity a document declares, and a fingerprint of its content in canonical JSON.
export interface DefinitionIdentity {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly fingerprint: string;
}

// The first problem of a document: an RFC 6901 pointer to it and what is wrong.
export interface CheckProblem {
  readonly pointer: string;
  readonly detail: string;
}

export interface DocumentValid {
  readonly kind: VerdictKind.Valid;
  readonly identity: DefinitionIdentity;
}

export interface DocumentInvalid {
  readonly kind: VerdictKind.Invalid;
  readonly problem: CheckProblem;
}

export type CheckVerdict = DocumentValid | DocumentInvalid;

// What the runtime refuses to run, decided before a document is published (FR-002).
export abstract class RuntimeChecks {
  abstract check(document: JsonObject): Promise<CheckVerdict>;
}

// What the runtime needs to run an instance: the published document and the instance's input.
export interface RunPlan {
  readonly instanceId: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly document: JsonObject;
  readonly input: JsonValue;
  readonly startedAt: string;
}

export interface TaskStarted {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly input: JsonValue;
  readonly at: string;
}

export interface TaskEnded {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly output: JsonValue;
  readonly error: JsonObject | null;
  readonly at: string;
}

// What the runtime tells the platform as it runs, and the platform's answer: go on, wait for a
// resume, or stop.
export abstract class RunObserver {
  abstract taskStarted(instanceId: string, task: TaskStarted): Promise<void>;
  abstract taskEnded(
    instanceId: string,
    task: TaskEnded,
  ): Promise<RunDirective>;
  abstract waiting(instanceId: string): Promise<void>;
  abstract running(instanceId: string): Promise<void>;
  abstract directive(instanceId: string): Promise<RunDirective>;
}

export interface RunCompleted {
  readonly kind: RunOutcomeKind.Completed;
  readonly output: JsonValue;
}

export interface RunFaulted {
  readonly kind: RunOutcomeKind.Faulted;
  readonly error: JsonObject;
}

// The platform stopped the run (the instance was cancelled): its end is already recorded.
export interface RunStopped {
  readonly kind: RunOutcomeKind.Stopped;
}

export type RunOutcome = RunCompleted | RunFaulted | RunStopped;

// The engine that runs instances: started with the instance in the caller's transaction,
// cancelled, resumed or forgotten after the commit.
export abstract class RunClient {
  abstract start(instanceId: string): Promise<void>;
  abstract cancel(instanceId: string): Promise<void>;
  abstract resume(instanceId: string): Promise<void>;
  abstract delete(instanceId: string): Promise<void>;
}
