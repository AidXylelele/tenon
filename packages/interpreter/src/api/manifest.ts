import type { EffectKind } from "./effects.js";
import type { CloudEvent } from "./events.js";

export interface WorkflowIdentity {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
}

export interface EverySchedule {
  readonly kind: "every";
  readonly interval: number;
}

export interface CronSchedule {
  readonly kind: "cron";
  readonly cron: string;
}

export interface AfterSchedule {
  readonly kind: "after";
  readonly delay: number;
}

export interface EventSchedule {
  readonly kind: "on";
  readonly stream: string;
  readonly types: readonly string[];
}

export type Schedule =
  EverySchedule | CronSchedule | AfterSchedule | EventSchedule;

export interface RoutingFilter {
  readonly stream: string;
  readonly level: number;
  readonly filter: number;
  readonly accepts: (event: CloudEvent) => boolean;
}

export interface Manifest {
  readonly identity: WorkflowIdentity;
  readonly effects: readonly EffectKind[];
  readonly secrets: readonly string[];
  readonly schedules: readonly Schedule[];
  readonly filters: readonly RoutingFilter[];
}
