import type { Phase, TaskRecord } from "@/libs/data-access/types";

export type RunStatus = "in-progress" | "succeeded" | "failed" | "cancelled";

export type StepStatus = Phase | "retrying" | "skipped";

export type StepState = StepStatus | "not-reached";

export interface TaskProgress {
  readonly status: TaskRecord["status"];
  readonly runs: number;
}

export interface SeenProgress {
  readonly progress: TaskProgress;
  readonly order: number;
}
