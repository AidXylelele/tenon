import type { CloudEvent, JsonObject, JsonValue } from "../../api/index.js";
import type { EventPayloadMember } from "../../standard/index.js";
import type { Attribute } from "./types.js";

const absent: Attribute = { kind: "absent" };

const payload: EventPayloadMember = "data";

const attributeName = /^[a-z0-9]+$/u;

export function attributeOf(event: CloudEvent, name: string): Attribute {
  const held = Object.hasOwn(event, name);

  if (!held) {
    return absent;
  }

  const value = event[name] ?? null;
  const unset = isUnset(name, value);

  if (unset) {
    return absent;
  }

  return { kind: "present", value };
}

export function isAttributeName(name: string): boolean {
  return attributeName.test(name);
}

export function setMembersOf(object: JsonObject): JsonObject {
  const members = Object.entries(object);
  const setMembers = members.filter(([name, value]) => !isUnset(name, value));

  return Object.fromEntries(setMembers);
}

function isUnset(name: string, value: JsonValue): boolean {
  const isPayload = name === payload;

  if (isPayload) {
    return false;
  }

  return value === null;
}
