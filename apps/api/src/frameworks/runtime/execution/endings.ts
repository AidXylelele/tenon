import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { StepRetry } from '../interfaces.js';
import type { Scope } from './scope.js';

export enum EndingKind {
  Completed = 'completed',
  Faulted = 'faulted',
  Stopped = 'stopped',
}

// A fault and the time an enclosing `try` runs its tasks again for it, decided where the fault
// arose and journaled there, or null when none does.
export interface Fault {
  readonly kind: EndingKind.Faulted;
  readonly error: JsonObject;
  readonly retryAt: number | null;
}

// How a task ended: with its output and the directive that picks the next task, with a fault,
// or stopped because the platform ended the instance.
export type TaskEnding =
  | {
      readonly kind: EndingKind.Completed;
      readonly output: JsonValue;
      readonly then: string | null;
    }
  | Fault
  | { readonly kind: EndingKind.Stopped };

// How a task list ended; `ended` when a task's `then: end` ends the whole workflow.
export type ListEnding =
  | {
      readonly kind: EndingKind.Completed;
      readonly output: JsonValue;
      readonly ended: boolean;
    }
  | Fault
  | { readonly kind: EndingKind.Stopped };

export interface TaskItem {
  readonly name: string;
  readonly task: Specification.Task;
}

// What a task does on a fault inside its step: retry it (the engine repeats the step after the
// delay drawn for the attempt) or let the fault end it. A `try` around a single task decides so;
// a fault it does not catch is for an enclosing `try`.
export interface AttemptPolicy {
  readonly retry: StepRetry;
  catches(error: JsonObject): Promise<boolean>;
  retries(error: JsonObject, attempt: number): Promise<boolean>;
  delayAfter(attempt: number): number;
}

// How a `try` that runs its tasks again decides for a fault inside them: when it runs them again,
// or null. A fault it does not catch is its enclosing `try`'s to decide.
export interface ListRetry {
  retryAt(error: JsonObject): Promise<number | null>;
}

// Runs tasks and task lists; composite kinds run their bodies through it.
export interface Runner {
  task(
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
    policy: AttemptPolicy | null,
  ): Promise<TaskEnding>;
  list(
    list: Specification.TaskList,
    input: JsonValue,
    scope: Scope,
  ): Promise<ListEnding>;
}

// `authorization`: what a call sent (`$authorization` of its `output.as` and `export.as`).
export interface LeafResult {
  readonly output: JsonValue;
  readonly then: string | null;
  readonly authorization?: JsonObject | null;
}

// A task whose whole work is one engine step: its effect is journaled once.
export interface LeafKind {
  run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult>;
}

// A task that runs other tasks or waits: its body runs outside a step, through the runner.
export interface CompositeKind {
  run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding>;
}
