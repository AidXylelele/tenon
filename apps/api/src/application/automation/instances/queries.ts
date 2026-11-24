import type {
  CountWindow,
  FailingWorkflows,
  FailureWindow,
  InstanceCounts,
  InstanceDetail,
  InstancePage,
  InstancePageRequest,
  ReceiverView,
  TaskOutput,
  TaskPage,
} from "./interfaces.js";

export abstract class InstanceQueries {
  static readonly MOST_COUNTED = 10_000;

  abstract list(request: InstancePageRequest): Promise<InstancePage>;
  abstract get(id: string): Promise<InstanceDetail | null>;
  abstract tasks(
    id: string,
    after: number | null,
    limit: number,
  ): Promise<TaskPage | null>;
  abstract counts(window: CountWindow): Promise<InstanceCounts>;
  abstract failing(window: FailureWindow): Promise<FailingWorkflows>;
  abstract taskOutput(
    id: string,
    execution: string,
  ): Promise<TaskOutput | null>;
}

export abstract class ReceiverQueries {
  abstract open(): Promise<readonly ReceiverView[]>;
  abstract demands(instanceId: string, execution: string): Promise<boolean>;
}
