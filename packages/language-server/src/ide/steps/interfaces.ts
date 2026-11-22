import type { ast } from "interpreter/front-end";

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

export interface Retry {
  readonly kind: "retry";
  readonly retries: number;
  readonly seconds: number;
  readonly growing: boolean;
}
