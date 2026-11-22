import type { JsonObject, JsonValue } from "./json.js";

export interface CloudEvent {
  readonly specversion: string;
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly [attribute: string]: JsonValue;
}

export interface EventFilter {
  accepts(event: CloudEvent): boolean;
}

interface WorkflowLifecycleEvent {
  readonly subject: "workflow";
  readonly name: string;
  readonly types: readonly string[];
  readonly data: JsonObject;
}

interface TaskLifecycleEvent {
  readonly subject: "task";
  readonly name: string;
  readonly types: readonly string[];
  readonly data: JsonObject;
  readonly execution: string;
}

export interface TaskValue {
  readonly execution: string;
  readonly value: JsonValue;
}

export type LifecycleEvent = WorkflowLifecycleEvent | TaskLifecycleEvent;
