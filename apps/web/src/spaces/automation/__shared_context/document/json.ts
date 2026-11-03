import { pointerOf, tokensOf } from '@/libs/document-text/json-pointer';
import type { JsonObject, JsonValue } from '@/libs/data-access/types';

// Immutable reads and writes into a JSON document by RFC 6901 pointer. A write returns a new
// document; nothing it was given changes.

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function valueAt(
  document: JsonValue,
  pointer: string,
): JsonValue | undefined {
  let node: JsonValue | undefined = document;

  for (const token of tokensOf(pointer)) {
    if (Array.isArray(node)) node = node[Number(token)];
    else if (isObject(node)) node = node[token];
    else return undefined;
  }

  return node;
}

export function withValue(
  document: JsonObject,
  pointer: string,
  value: JsonValue,
): JsonObject {
  const tokens = tokensOf(pointer);
  return written(document, tokens, value) as JsonObject;
}

// Removes the member or item at the pointer; a missing one leaves the document as it is.
export function withoutValue(
  document: JsonObject,
  pointer: string,
): JsonObject {
  const tokens = tokensOf(pointer);
  const last = tokens.pop();

  if (last === undefined) return document;

  const parentPointer = pointerOf(tokens);
  const parent = valueAt(document, parentPointer);

  if (Array.isArray(parent)) {
    const items = parent.filter((_, index) => index !== Number(last));
    return withValue(document, parentPointer, items);
  }

  if (!isObject(parent) || !(last in parent)) return document;

  const rest = Object.fromEntries(
    Object.entries(parent).filter(([key]) => key !== last),
  );
  return withValue(document, parentPointer, rest);
}

// Sets or removes a member: `undefined` and empty strings remove it, so a form that clears a
// field leaves no empty member behind.
export function withMember(
  document: JsonObject,
  pointer: string,
  value: JsonValue | undefined,
): JsonObject {
  if (value === undefined || value === '')
    return withoutValue(document, pointer);

  return withValue(document, pointer, value);
}

function written(
  node: JsonValue | undefined,
  tokens: readonly string[],
  value: JsonValue,
): JsonValue {
  const [token, ...rest] = tokens;

  if (token === undefined) return value;

  if (Array.isArray(node)) {
    const items = node.slice();
    items[Number(token)] = written(node[Number(token)], rest, value);
    return items;
  }

  const object = isObject(node) ? node : {};
  return { ...object, [token]: written(object[token], rest, value) };
}
