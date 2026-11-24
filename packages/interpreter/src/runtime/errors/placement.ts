import type { JsonObject } from "../../api/index.js";
import { instanceProperty } from "../../standard/index.js";

export function placedAt(error: JsonObject, reference: string): JsonObject {
  const isPlaced = Object.hasOwn(error, instanceProperty);

  if (isPlaced) {
    return error;
  }

  return { ...error, [instanceProperty]: reference };
}
