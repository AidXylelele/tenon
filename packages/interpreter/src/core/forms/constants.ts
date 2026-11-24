import type { JsonObject, JsonValue } from "../../api/index.js";
import { isJsonArray, isJsonObject } from "../../runtime/index.js";

type Member = readonly [string, JsonValue];

export function constantOf(value: JsonValue): JsonValue {
  const isArray = isJsonArray(value);

  if (isArray) {
    const items = value.map(constantOf);
    return Object.freeze(items);
  }

  const isObject = isJsonObject(value);

  if (isObject) {
    return constantObjectOf(value);
  }

  return value;
}

export function constantObjectOf(object: JsonObject): JsonObject {
  const members = Object.entries(object);
  const constants = members.map(constantMemberOf);
  const copy = Object.fromEntries(constants);

  return Object.freeze(copy);
}

export function constantTextsOf(
  texts: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const named = Object.entries(texts);
  const copy = Object.fromEntries(named);

  return Object.freeze(copy);
}

export function constantListOf<Item>(items: readonly Item[]): readonly Item[] {
  const copy = [...items];
  return Object.freeze(copy);
}

function constantMemberOf(member: Member): Member {
  const [name, value] = member;
  const constant = constantOf(value);

  return [name, constant];
}
