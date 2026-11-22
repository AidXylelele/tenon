import type { Step } from "../api/index.js";

export type CompileSubject = "workflow" | "filter";

export type CompilePhase = "analyze" | "translate";

export interface PhaseTiming {
  readonly phase: CompilePhase;
  readonly seconds: number;
}

export interface Compiled {
  readonly kind: "compiled" | "refused";
}

export type Operation =
  "start" | "correlate" | "respond" | "suspend" | "resume" | "cancel";

export interface StepMeasure {
  readonly instance: string;
  readonly status: Step["status"];
  readonly transitions: number;
  readonly fibers: number;
  readonly requested: number;
  readonly events: number;
  readonly lifetime: number | null;
}

export interface Played {
  readonly step: Step;
  readonly measure: StepMeasure;
}
