export interface ScheduleRunInput {
  readonly workflowId: string;
  readonly delayMs: number;
  readonly chained: boolean;
}
