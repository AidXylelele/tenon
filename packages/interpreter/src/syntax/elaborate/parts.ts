import type { JsonObject } from "../../api/index.js";
import {
  InterpreterError,
  childPointerOf,
  isJsonArray,
  isJsonObject,
} from "../../runtime/index.js";
import type { Field, Part } from "./types.js";

const nothing: JsonObject = {};

const none: readonly Part[] = [];

export function fieldOf(parent: Part, name: string): Part | null {
  const object = objectOf(parent);
  const value = object[name];

  if (value === undefined) {
    return null;
  }

  const isOwn = Object.hasOwn(object, name);

  if (!isOwn) {
    return null;
  }

  const pointer = childPointerOf(parent.pointer, name);
  return { value, pointer, mode: parent.mode };
}

export function requiredFieldOf(parent: Part, name: string): Part {
  const field = fieldOf(parent, name);

  if (field === null) {
    const pointer = childPointerOf(parent.pointer, name);
    throw uncheckedOf(pointer);
  }

  return field;
}

export function objectFieldOf(parent: Part, name: string): Part {
  const field = fieldOf(parent, name);

  if (field !== null) {
    return field;
  }

  const pointer = childPointerOf(parent.pointer, name);
  return { value: nothing, pointer, mode: parent.mode };
}

export function objectAt(parent: Part, name: string): JsonObject {
  const field = objectFieldOf(parent, name);
  return objectOf(field);
}

export function fieldsOf(part: Part): readonly Field[] {
  const object = objectOf(part);

  return Object.keys(object).map((name) => {
    const field = requiredFieldOf(part, name);
    return { name, part: field };
  });
}

export function soleFieldOf(item: Part): Field {
  const fields = fieldsOf(item);
  const [field] = fields;
  const isSole = field !== undefined && fields.length === 1;

  if (!isSole) {
    throw uncheckedOf(item.pointer);
  }

  return field;
}

export function itemsOf(part: Part): readonly Part[] {
  const value = part.value;
  const isList = isJsonArray(value);

  if (!isList) {
    throw uncheckedOf(part.pointer);
  }

  return value.map((item, index) => {
    const pointer = childPointerOf(part.pointer, index);
    return { value: item, pointer, mode: part.mode };
  });
}

export function listAt(parent: Part, name: string): readonly Part[] {
  const field = fieldOf(parent, name);

  if (field === null) {
    return none;
  }

  return itemsOf(field);
}

export function mapAt<Node>(
  parent: Part,
  name: string,
  nodeOf: (part: Part, name: string) => Node,
): ReadonlyMap<string, Node> {
  const map = objectFieldOf(parent, name);
  const entries = fieldsOf(map).map((field) => {
    const node = nodeOf(field.part, field.name);
    return [field.name, node] as const;
  });

  return new Map(entries);
}

export function optionalAt<Node>(
  parent: Part,
  name: string,
  nodeOf: (part: Part) => Node,
): Node | null {
  const field = fieldOf(parent, name);

  if (field === null) {
    return null;
  }

  return nodeOf(field);
}

export function requiredAt<Node>(
  parent: Part,
  name: string,
  nodeOf: (part: Part) => Node,
): Node {
  const field = requiredFieldOf(parent, name);
  return nodeOf(field);
}

export function objectOf(part: Part): JsonObject {
  const value = part.value;
  const isObject = isJsonObject(value);

  if (!isObject) {
    throw uncheckedOf(part.pointer);
  }

  return value;
}

export function uncheckedOf(pointer: string): InterpreterError {
  return new InterpreterError(
    `The document at '${pointer}' is not as the grammar admits it: elaborate only a document that passed the grammar check.`,
  );
}
