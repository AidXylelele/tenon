import type { ExpressionMode, ReadMode } from "../../standard/index.js";
import type { Use } from "./components.js";
import type { Duration, Input, Output, Reference } from "./data.js";
import type { Timeout } from "./errors.js";
import type { ConsumptionStrategy } from "./events.js";
import type { TaskList } from "./tasks.js";

export interface Workflow {
  readonly pointer: string;
  readonly document: DocumentHeader;
  readonly input: Input;
  readonly use: Use;
  readonly do: TaskList;
  readonly timeout: Timeout | Reference | null;
  readonly output: Output;
  readonly schedules: readonly Schedule[];
  readonly evaluate: Evaluate;
}

export interface DocumentHeader {
  readonly pointer: string;
  readonly dsl: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly title: string | null;
  readonly summary: string | null;
}

export interface EverySchedule {
  readonly kind: "every";
  readonly pointer: string;
  readonly interval: Duration;
}

export interface CronSchedule {
  readonly kind: "cron";
  readonly pointer: string;
  readonly cron: string;
}

export interface AfterSchedule {
  readonly kind: "after";
  readonly pointer: string;
  readonly delay: Duration;
}

export interface EventSchedule {
  readonly kind: "on";
  readonly pointer: string;
  readonly strategy: ConsumptionStrategy;
  readonly read: ReadMode;
}

export type Schedule =
  EverySchedule | CronSchedule | AfterSchedule | EventSchedule;

export interface Evaluate {
  readonly pointer: string;
  readonly language: string;
  readonly mode: ExpressionMode;
}
