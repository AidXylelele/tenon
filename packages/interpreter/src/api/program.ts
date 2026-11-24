import type { EffectResponse } from "./effects.js";
import type { JsonValue } from "./json.js";
import type { Manifest } from "./manifest.js";
import type { StartContext, State, Step, StepContext } from "./steps.js";

export interface InputProblem {
  readonly pointer: string;
  readonly detail: string;
}

export interface Program {
  readonly manifest: Manifest;
  readonly fingerprint: string;
  inputProblemsOf(input: JsonValue): readonly InputProblem[];
  start(input: JsonValue, context: StartContext): Step;
  correlate(context: StartContext): Step;
  respond(state: State, response: EffectResponse, context: StepContext): Step;
  suspend(state: State, context: StepContext): Step;
  resume(state: State, context: StepContext): Step;
  cancel(state: State, context: StepContext): Step;
}
