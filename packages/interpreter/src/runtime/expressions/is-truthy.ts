import type { JsonValue } from "../../api/index.js";

export function isTruthy(value: JsonValue): boolean {
  return value !== false && value !== null;
}
