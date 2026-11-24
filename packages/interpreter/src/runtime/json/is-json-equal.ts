import type { JsonObject, JsonValue } from "../../api/index.js";
import { isJsonArray, isJsonObject } from "./json-kinds.js";

export function isJsonEqual(left: JsonValue, right: JsonValue): boolean {
  const isArray = isJsonArray(left);

  if (isArray) {
    return isJsonArray(right) && areItemsEqual(left, right);
  }

  const isObject = isJsonObject(left);

  if (isObject) {
    return isJsonObject(right) && areMembersEqual(left, right);
  }

  return left === right;
}

function areItemsEqual(
  left: readonly JsonValue[],
  right: readonly JsonValue[],
): boolean {
  const sameLength = left.length === right.length;
  return (
    sameLength && left.every((_, index) => isItemEqual(left, right, index))
  );
}

function isItemEqual(
  left: readonly JsonValue[],
  right: readonly JsonValue[],
  index: number,
): boolean {
  const item = left[index] ?? null;
  const other = right[index] ?? null;

  return isJsonEqual(item, other);
}

function areMembersEqual(left: JsonObject, right: JsonObject): boolean {
  const names = Object.keys(left);
  const sameSize = names.length === Object.keys(right).length;

  return sameSize && names.every((name) => isMemberEqual(left, right, name));
}

function isMemberEqual(
  left: JsonObject,
  right: JsonObject,
  name: string,
): boolean {
  const value = left[name] ?? null;
  const other = right[name] ?? null;

  return Object.hasOwn(right, name) && isJsonEqual(value, other);
}
