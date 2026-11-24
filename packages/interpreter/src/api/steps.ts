import type { Effect, EffectId } from "./effects.js";
import type { WorkflowError } from "./errors.js";
import type { LifecycleEvent, TaskValue } from "./events.js";
import type { JsonObject, JsonValue } from "./json.js";

declare const memento: unique symbol;

export type State = JsonObject & { readonly [memento]: "State" };

export interface RuntimeDescriptor {
  readonly name: string;
  readonly version: string;
  readonly metadata: JsonObject;
}

export interface StepContext {
  readonly now: number;
  readonly secrets: JsonObject;
  readonly runtime: RuntimeDescriptor;
}

export interface StartContext extends StepContext {
  readonly instance: string;
}

interface StepCommon {
  readonly state: State;
  readonly requested: readonly Effect[];
  readonly withdrawn: readonly EffectId[];
  readonly declined: readonly string[];
  readonly events: readonly LifecycleEvent[];
  readonly taskInputs: readonly TaskValue[];
  readonly taskOutputs: readonly TaskValue[];
}

interface RunningStep extends StepCommon {
  readonly status: "running";
}

interface SuspendedStep extends StepCommon {
  readonly status: "suspended";
}

interface CompletedStep extends StepCommon {
  readonly status: "completed";
  readonly output: JsonValue;
}

interface FaultedStep extends StepCommon {
  readonly status: "faulted";
  readonly error: WorkflowError;
}

interface CancelledStep extends StepCommon {
  readonly status: "cancelled";
}

export type Step =
  RunningStep | SuspendedStep | CompletedStep | FaultedStep | CancelledStep;
