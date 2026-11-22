import { isMemberOf } from "../../standard/index.js";
import { fieldOf, objectOf, requiredFieldOf, uncheckedOf } from "./parts.js";
import type { Part } from "./types.js";

export function textOf(part: Part): string {
  const value = part.value;

  if (typeof value !== "string") {
    throw uncheckedOf(part.pointer);
  }

  return value;
}

export function numberOf(part: Part): number {
  const value = part.value;

  if (typeof value !== "number") {
    throw uncheckedOf(part.pointer);
  }

  return value;
}

export function booleanOf(part: Part): boolean {
  const value = part.value;

  if (typeof value !== "boolean") {
    throw uncheckedOf(part.pointer);
  }

  return value;
}

function memberOf<Member extends string>(
  part: Part,
  catalogue: readonly Member[],
): Member {
  const text = textOf(part);
  const isMember = isMemberOf(catalogue, text);

  if (!isMember) {
    throw uncheckedOf(part.pointer);
  }

  return text;
}

export function optionalMemberAt<Member extends string>(
  parent: Part,
  name: string,
  catalogue: readonly Member[],
): Member | null {
  const field = fieldOf(parent, name);

  if (field === null) {
    return null;
  }

  return memberOf(field, catalogue);
}

export function requiredMemberAt<Member extends string>(
  parent: Part,
  name: string,
  catalogue: readonly Member[],
): Member {
  const field = requiredFieldOf(parent, name);
  return memberOf(field, catalogue);
}

export function keyOf<Member extends string>(
  part: Part,
  catalogue: readonly Member[],
): Member {
  const object = objectOf(part);
  const keys = Object.keys(object);
  const key = keys.find((candidate) => isMemberOf(catalogue, candidate));

  if (key === undefined) {
    throw uncheckedOf(part.pointer);
  }

  return key;
}
