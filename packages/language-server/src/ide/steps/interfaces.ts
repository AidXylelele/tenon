import type { ast, JsonObject } from "interpreter/front-end";

export type ListPart = "do" | "for" | "branches" | "try" | "catch" | "foreach";

export type ListRole = "sequence" | "branches";

export interface StepNode {
  readonly id: string;
  readonly pointer: string;
  readonly name: string;
  readonly task: ast.Task;
  readonly list: string;
  readonly index: number;
  readonly lists: readonly StepNodeList[];
}

export interface StepNodeList {
  readonly id: string;
  readonly pointer: string;
  readonly part: ListPart | null;
  readonly role: ListRole;
  readonly steps: readonly StepNode[];
}

export interface StepTree {
  readonly root: StepNodeList;
  readonly steps: ReadonlyMap<string, StepNode>;
  readonly lists: ReadonlyMap<string, StepNodeList>;
}

export interface NamedPlace {
  readonly pointer: string;
  readonly name: string;
}

export interface HeldList {
  readonly list: ast.TaskList;
  readonly part: ListPart | null;
  readonly role: ListRole;
}

export type FailureKind = "stop" | "continue" | "retry" | "handle";

export type Afterward = "stop" | "continue" | "handle";

export type ListEnd = "end" | "exit";

export type RetriedErrors =
  | { readonly kind: "any" }
  | { readonly kind: "statuses"; readonly statuses: readonly number[] }
  | { readonly kind: "timeouts" };

export type RetryOn = RetriedErrors | { readonly kind: "written" };

export interface RetrySetting {
  readonly retries: number | null;
  readonly milliseconds: number;
  readonly backoff: ast.Backoff["kind"];
  readonly on: RetryOn;
}

export interface RetryFields {
  readonly when: string | null;
  readonly delay: JsonObject | null;
  readonly backoff: JsonObject;
  readonly count: number | null;
}

export type RetryFieldsReading =
  | { readonly kind: "fields"; readonly fields: RetryFields }
  | { readonly kind: "refused"; readonly reason: string };
