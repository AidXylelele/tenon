import type { ExpressionResolution, Range } from "interpreter/front-end";

export interface Variable {
  readonly name: string;
  readonly range: Range;
  readonly resolution: ExpressionResolution;
}

export interface Token {
  readonly from: number;
  readonly to: number;
}
