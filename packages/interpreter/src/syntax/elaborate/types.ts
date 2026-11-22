import type { JsonValue } from "../../api/index.js";
import type { ExpressionMode } from "../../standard/index.js";

export interface Part {
  readonly value: JsonValue;
  readonly pointer: string;
  readonly mode: ExpressionMode;
}

export interface Field {
  readonly name: string;
  readonly part: Part;
}
