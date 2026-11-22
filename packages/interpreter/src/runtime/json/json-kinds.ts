import type { JsonObject, JsonValue } from "../../api/index.js";

export function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !isJsonArray(value);
}

export function isJsonScalar(
  value: unknown,
): value is string | number | boolean | null {
  const finite = typeof value === "number" && Number.isFinite(value);
  const text = typeof value === "string" || typeof value === "boolean";

  return value === null || finite || text;
}
