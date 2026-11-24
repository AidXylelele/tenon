import type { StepCall } from "../interfaces.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}
