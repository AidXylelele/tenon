import type { JsonObject } from "./json.js";

export interface WorkflowError extends JsonObject {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
}
