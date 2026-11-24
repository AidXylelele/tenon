import type { Range } from "interpreter/front-end";

export interface TextChange {
  readonly range: Range;
  readonly text: string;
}
