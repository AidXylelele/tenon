import type { SlotMeaning } from "../forms/index.js";
import type { StaticActivations } from "./static-activations.js";
import type { StaticEnvironment } from "./static-environment.js";

export type StaticFrame = readonly SlotMeaning[];

export interface Slot {
  readonly depth: number;
  readonly index: number;
}

export type ActivationMark = "own" | "transparent";

export interface StaticScope {
  readonly environment: StaticEnvironment;
  readonly activations: StaticActivations;
}
