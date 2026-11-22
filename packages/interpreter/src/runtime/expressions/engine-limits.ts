import type { JsonValue } from "../../api/index.js";
import {
  isJsonArray,
  isJsonObject,
  isNestedDeeperThan,
} from "../json/index.js";

const deepestNesting = 512;

export const tooDeepForEngine = `An expression cannot read a value nested deeper than ${String(deepestNesting)} levels.`;
export const beyondDoubles =
  "The expression gave a number beyond the range of a double.";

export function isTooDeepForEngine(value: JsonValue): boolean {
  return isNestedDeeperThan(value, deepestNesting);
}

export function isWithinDoubles(value: JsonValue): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  const isArray = isJsonArray(value);

  if (isArray) {
    return value.every((item) => isWithinDoubles(item));
  }

  const isObject = isJsonObject(value);

  if (isObject) {
    const members = Object.values(value);
    return members.every((member) => isWithinDoubles(member));
  }

  return true;
}

export function isKeptByEngine(value: JsonValue): boolean {
  return isKeptWithin(value, deepestNesting);
}

function isKeptWithin(value: JsonValue, levels: number): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0);
  }

  if (typeof value === "string") {
    return value.isWellFormed();
  }

  const isScalar = value === null || typeof value === "boolean";

  if (isScalar) {
    return true;
  }

  if (levels === 0) {
    return false;
  }

  const inner = levels - 1;
  const isArray = isJsonArray(value);

  if (isArray) {
    return value.every((item) => isKeptWithin(item, inner));
  }

  const keys = Object.keys(value);

  return keys.every((key) => {
    const member = value[key] ?? null;
    return key.isWellFormed() && isKeptWithin(member, inner);
  });
}
