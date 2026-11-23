import type { JsonArray, JsonObject, JsonValue } from "interpreter/front-end";

export function childPointerOf(pointer: string, token: string): string {
  const escaped = token.replaceAll("~", "~0").replaceAll("/", "~1");

  return `${pointer}/${escaped}`;
}

export function parentPointerOf(pointer: string): string {
  const end = pointer.lastIndexOf("/");

  return pointer.slice(0, end);
}

export function lastTokenOf(pointer: string): string {
  const start = pointer.lastIndexOf("/") + 1;
  const escaped = pointer.slice(start);

  return unescapedOf(escaped);
}

export function valueAt(
  document: JsonValue,
  pointer: string,
): JsonValue | undefined {
  const tokens = pointer.split("/").slice(1).map(unescapedOf);

  return tokens.reduce<JsonValue | undefined>(memberOf, document);
}

function memberOf(
  value: JsonValue | undefined,
  token: string,
): JsonValue | undefined {
  const isComposite = typeof value === "object" && value !== null;

  if (!isComposite) {
    return undefined;
  }

  const isList = isJsonArray(value);

  if (isList) {
    const index = Number(token);
    return value[index];
  }

  const isMember = Object.hasOwn(value, token);

  return isMember ? value[token] : undefined;
}

export function withValueAt(
  document: JsonValue,
  pointer: string,
  value: JsonValue,
): JsonValue {
  if (pointer === "") {
    return value;
  }

  const holderPointer = parentPointerOf(pointer);
  const holder = valueAt(document, holderPointer);
  const token = lastTokenOf(pointer);
  const held = heldOf(holder, token, value);

  return withValueAt(document, holderPointer, held);
}

function heldOf(
  holder: JsonValue | undefined,
  token: string,
  value: JsonValue,
): JsonValue {
  const isObject = isJsonObject(holder);

  if (isObject) {
    return { ...holder, [token]: value };
  }

  const isList = typeof holder === "object" && holder !== null;

  if (isList) {
    const index = Number(token);
    return holder.with(index, value);
  }

  return { [token]: value };
}

export function isJsonObject(value: unknown): value is JsonObject {
  const isComposite = typeof value === "object" && value !== null;

  return isComposite && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue | undefined): value is JsonArray {
  return Array.isArray(value);
}

function unescapedOf(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}
