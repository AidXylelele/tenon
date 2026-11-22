import type { JsonValue } from "../../api/index.js";

export interface TaskFacts {
  readonly name: string;
  readonly reference: string;
  readonly definition: JsonValue;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly startedAt: number;
}

export interface WorkflowFacts {
  readonly id: string;
  readonly definition: JsonValue;
  readonly input: JsonValue;
  readonly startedAt: number;
}
