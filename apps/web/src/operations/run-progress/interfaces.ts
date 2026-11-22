import type { TaskRecord } from "@/libs/data-access/types";

export interface TaskProgress {
  readonly status: TaskRecord["status"];
  readonly runs: number;
}

export interface SeenProgress {
  readonly progress: TaskProgress;
  readonly order: number;
}
