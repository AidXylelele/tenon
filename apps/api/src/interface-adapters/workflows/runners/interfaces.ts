export interface ScheduleRunInput {
  readonly workflowId: string;
  readonly delayMs: number;
  readonly chained: boolean;
}

export interface DeliveryRunInput {
  readonly subscriptionId: string;
  readonly sequence: number;
}
