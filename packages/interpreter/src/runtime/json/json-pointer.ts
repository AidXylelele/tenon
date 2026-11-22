import type { JsonValue } from "../../api/index.js";
import { InterpreterError } from "../faults/index.js";
import { isJsonArray, isJsonObject } from "./json-kinds.js";

export const rootPointer = "";

export function childPointerOf(parent: string, token: string | number): string {
  const text = String(token);
  const escaped = text.replaceAll("~", "~0").replaceAll("/", "~1");

  return `${parent}/${escaped}`;
}

export function tokensOf(pointer: string): readonly string[] {
  if (pointer === rootPointer) {
    return [];
  }

  const tokens = pointer.slice(1).split("/");
  return tokens.map(unescape);
}

export function lastTokenOf(pointer: string): string | null {
  if (pointer === rootPointer) {
    return null;
  }

  const start = pointer.lastIndexOf("/") + 1;
  const token = pointer.slice(start);

  return unescape(token);
}

export function isPointerWithin(pointer: string, root: string): boolean {
  return pointer === root || pointer.startsWith(`${root}/`);
}

export function relativePointerOf(base: string, pointer: string): string {
  const baseParts = base.split("/");
  const parts = pointer.split("/");
  const isBelow = baseParts.every((part, index) => parts[index] === part);

  if (!isBelow) {
    throw new InterpreterError(
      `The pointer '${pointer}' is not at or below '${base}'.`,
    );
  }

  const steps = parts.slice(baseParts.length);
  return steps.map((token) => `/${token}`).join("");
}

export function pointedValueOf(value: JsonValue, pointer: string): JsonValue {
  const tokens = tokensOf(pointer);
  return tokens.reduce(childValueOf, value);
}

function unescape(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function childValueOf(value: JsonValue, token: string): JsonValue {
  const isArray = isJsonArray(value);

  if (isArray) {
    const index = Number(token);
    return value[index] ?? null;
  }

  const isObject = isJsonObject(value);

  if (!isObject) {
    return null;
  }

  const isOwn = Object.hasOwn(value, token);

  if (!isOwn) {
    return null;
  }

  return value[token] ?? null;
}
