import type { StandardErrorName } from "../../standard/index.js";

export interface StandardProblem {
  readonly name: StandardErrorName;
  readonly detail: string;
  readonly status: number;
}
