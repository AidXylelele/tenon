import type { Problem } from "../snapshot/index.js";
import type { TextChange } from "../text/index.js";

export interface Fix {
  readonly title: string;
  readonly diagnostic: Problem;
  readonly changes: readonly TextChange[];
}
