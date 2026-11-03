import type { TaskStatus } from '../../application/automation/instances/enums.js';
import type {
  Phase,
  RunDirective,
} from '../../domain/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../domain/automation/json.js';
import type { RunOutcomeKind, TimingKind, VerdictKind } from './enums.js';

// The identity a document declares, and a fingerprint of its content in canonical JSON.
export interface DefinitionIdentity {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly fingerprint: string;
  // The types `schedule.on` starts instances on: null without it, empty when any type.
  readonly eventTypes: readonly string[] | null;
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

// The runtime's statement of partial conformance to the standard (ER-001).
export interface ConformanceStatement {
  readonly dsl: readonly string[];
  readonly tasks: readonly string[];
  readonly calls: readonly string[];
  readonly runs: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly authentications: readonly string[];
  readonly excluded: readonly string[];
  readonly contradictions: readonly string[];
}

// What the runtime refuses to run, decided before a document is published (FR-002), against
// the subset it states.
export abstract class RuntimeChecks {
  // `secrets`: the names the document's `use.secrets` may name.
  abstract check(
    document: JsonObject,
    secrets: readonly string[],
  ): Promise<CheckVerdict>;
  abstract statement(): ConformanceStatement;
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
  abstract startChild(
    parentId: string,
    child: ChildRequest,
  ): Promise<ChildStart>;
  abstract outcomeOf(childId: string): Promise<ChildOutcome>;
  // A `listen` task waits for events sent to `key`; `types` narrows them, null for any type.
  abstract listen(
    instanceId: string,
    key: string,
    types: string[] | null,
  ): Promise<void>;
  abstract unlisten(instanceId: string, key: string): Promise<void>;
  // An event an `emit` task published, accepted as any other event.
  abstract emitted(instanceId: string, event: JsonObject): Promise<void>;
  // The values of the secrets named, of the publisher of the instance's version, as kept now;
  // a missing name is a secret that does not exist (any more).
  abstract secrets(
    instanceId: string,
    names: readonly string[],
  ): Promise<Record<string, string>>;
}

// A sub-workflow a `run: workflow` task starts; a detached one is not awaited.
export interface ChildRequest {
  readonly namespace: string;
  readonly name: string;
  // The version named, or null for the current one (the standard's `latest`).
  readonly version: string | null;
  readonly input: JsonValue;
  readonly detached: boolean;
}

// The child instance's id, or why the platform refused to start it (null when it started).
export interface ChildStart {
  readonly childId: string | null;
  readonly refusal: string | null;
}

export interface ChildOutcome {
  readonly phase: Phase | null;
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
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
  // An accepted event sent to the run listening under the key, once per signal id.
  abstract deliver(
    key: string,
    event: JsonObject,
    signalId: string,
  ): Promise<void>;
}

// A schedule's timing as the engine runs it.
export type ScheduleTiming =
  | { readonly kind: TimingKind.Cron; readonly cron: string }
  | { readonly kind: TimingKind.Every; readonly everyMs: number }
  | { readonly kind: TimingKind.After; readonly afterMs: number };

// A document's `schedule` timing, read by the runtime: null without cron, every or after.
export abstract class TimingClient {
  abstract timingOf(document: JsonObject): ScheduleTiming | null;
}

// The engine's schedules of a workflow: the occurrences of a cron or an interval, and the
// links of an `after` chain. `revision` tells apart the chains each turn-on starts.
export abstract class ScheduleClient {
  abstract apply(
    workflowId: string,
    revision: number,
    timing: ScheduleTiming | null,
  ): Promise<void>;
  abstract clear(workflowId: string): Promise<void>;
  // In the caller's transaction: the link after the completed instance, for an `after`.
  abstract continueAfter(
    workflowId: string,
    previousId: string,
    timing: ScheduleTiming | null,
  ): Promise<void>;
}

// Whether an event satisfies a document's `schedule.on`.
export abstract class TriggerClient {
  abstract accepts(document: JsonObject, event: JsonObject): Promise<boolean>;
}

// The standard's event filter (`with`), as the runtime reads it for a subscription.
export abstract class FilterClient {
  abstract problemOf(filter: JsonObject): Promise<CheckProblem | null>;
  abstract typesOf(filter: JsonObject): string[] | null;
  abstract accepts(filter: JsonObject, event: JsonObject): Promise<boolean>;
}

// The engine's delivery of one event to one subscription, retried for about 24 hours; in the
// caller's transaction, once per subscription and event.
export abstract class DeliveryRunClient {
  abstract start(subscriptionId: string, sequence: number): Promise<void>;
}
