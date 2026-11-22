import type {
  CountWindow,
  InstanceCounts,
  InstanceDetail,
  InstanceFilter,
  InstancePage,
  InstancePosition,
  ReceiverView,
  TaskOutput,
  TaskPage,
} from "./interfaces.js";

export abstract class InstanceQueries {
  abstract list(
    filter: InstanceFilter,
    after: InstancePosition | null,
    limit: number,
  ): Promise<InstancePage>;
  abstract get(id: string): Promise<InstanceDetail | null>;
  abstract tasks(
    id: string,
    after: number | null,
    limit: number,
  ): Promise<TaskPage | null>;
  abstract counts(window: CountWindow): Promise<InstanceCounts>;
  abstract taskOutput(
    id: string,
    execution: string,
  ): Promise<TaskOutput | null>;
}

export abstract class ReceiverQueries {
  abstract open(): Promise<readonly ReceiverView[]>;
  abstract demands(instanceId: string, execution: string): Promise<boolean>;
}
