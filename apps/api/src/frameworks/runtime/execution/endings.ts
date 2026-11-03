import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { StepRetry } from '../interfaces.js';
import type { Scope } from './scope.js';

export enum EndingKind {
  Completed = 'completed',
  Faulted = 'faulted',
  Stopped = 'stopped',
}

// How a task ended: with its output and the directive that picks the next task, with an error,
// or stopped because the platform ended the instance.
export type TaskEnding =
  | {
      readonly kind: EndingKind.Completed;
      readonly output: JsonValue;
      readonly then: string | null;
    }
  | { readonly kind: EndingKind.Faulted; readonly error: JsonObject }
  | { readonly kind: EndingKind.Stopped };

// How a task list ended; `ended` when a task's `then: end` ends the whole workflow.
export type ListEnding =
  | {
      readonly kind: EndingKind.Completed;
      readonly output: JsonValue;
      readonly ended: boolean;
    }
  | { readonly kind: EndingKind.Faulted; readonly error: JsonObject }
  | { readonly kind: EndingKind.Stopped };

export interface TaskItem {
  readonly name: string;
  readonly task: Specification.Task;
}

// What a task does on a fault inside its step: retry it (the engine repeats the step) or let
// the fault end it. A `try` around a single task decides so.
export interface AttemptPolicy {
  readonly retry: StepRetry;
  retries(error: JsonObject, attempt: number): Promise<boolean>;
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
