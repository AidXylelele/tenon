import type { JsonValue } from "../../api/index.js";
import { isJsonArray, isJsonObject } from "./json-kinds.js";

export function isNestedDeeperThan(value: JsonValue, limit: number): boolean {
  return isDeeper(value, 1, limit);
}

function isDeeper(value: JsonValue, depth: number, limit: number): boolean {
  const children = childrenOf(value);

  if (children === null) {
    return false;
  }

  if (depth > limit) {
    return true;
  }

  const childDepth = depth + 1;
  return children.some((child) => isDeeper(child, childDepth, limit));
}

function childrenOf(value: JsonValue): readonly JsonValue[] | null {
  const isArray = isJsonArray(value);

  if (isArray) {
    return value;
  }

  const isObject = isJsonObject(value);

  if (!isObject) {
    return null;
  }

  return Object.values(value);
}
