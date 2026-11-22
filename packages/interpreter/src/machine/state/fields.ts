import type { JsonArray, JsonObject, JsonValue } from "../../api/index.js";
import type { Term } from "../../core/index.js";
import {
  InterpreterError,
  isJsonArray,
  isJsonObject,
} from "../../runtime/index.js";
import { isMemberOf } from "../../standard/index.js";

export type KindSet<Kind extends string> = Readonly<Record<Kind, true>>;

export type FormOf<Form extends Term["form"]> = Extract<Term, { form: Form }>;

export function fieldAt(encoded: JsonValue, key: string): JsonValue {
  const isObject = isJsonObject(encoded);

  if (!isObject) {
    throw faultAt(key, "value");
  }

  const value = encoded[key];

  if (value === undefined) {
    throw faultAt(key, "value");
  }

  return value;
}

export function objectAt(encoded: JsonObject, key: string): JsonObject {
  const value = fieldAt(encoded, key);
  const isObject = isJsonObject(value);

  if (!isObject) {
    throw faultAt(key, "object");
  }

  return value;
}

export function arrayAt(encoded: JsonObject, key: string): JsonArray {
  const value = fieldAt(encoded, key);
  const isArray = isJsonArray(value);

  if (!isArray) {
    throw faultAt(key, "array");
  }

  return value;
}

export function objectsAt(
  encoded: JsonObject,
  key: string,
): readonly JsonObject[] {
  const values = arrayAt(encoded, key);
  const objects = values.filter(isJsonObject);

  if (objects.length !== values.length) {
    throw faultAt(key, "array of objects");
  }

  return objects;
}

export function numberAt(encoded: JsonObject, key: string): number {
  const value = fieldAt(encoded, key);

  if (typeof value !== "number") {
    throw faultAt(key, "number");
  }

  return value;
}

export function indexAt(encoded: JsonObject, key: string): number {
  const value = fieldAt(encoded, key);
  const isPosition = isIndex(value);

  if (!isPosition) {
    throw faultAt(key, "whole number from zero");
  }

  return value;
}

export function indicesAt(encoded: JsonObject, key: string): readonly number[] {
  const values = arrayAt(encoded, key);
  const indices = values.filter(isIndex);

  if (indices.length !== values.length) {
    throw faultAt(key, "array of whole numbers from zero");
  }

  return indices;
}

export function stringAt(encoded: JsonObject, key: string): string {
  const value = fieldAt(encoded, key);

  checkText(value, key);
  return value;
}

export function checkTextAt(encoded: JsonObject, key: string): void {
  const value = fieldAt(encoded, key);

  checkText(value, key);
}

export function memberAt<Member extends string>(
  encoded: JsonObject,
  key: string,
  catalogue: readonly Member[],
): Member {
  return admittedAt(encoded, key, (value) => isMemberOf(catalogue, value));
}

export function kindAt<Kind extends string>(
  encoded: JsonObject,
  kinds: KindSet<Kind>,
): Kind {
  return ownMemberAt(encoded, "kind", kinds);
}

export function ownMemberAt<Member extends string>(
  encoded: JsonObject,
  key: string,
  members: KindSet<Member>,
): Member {
  return admittedAt(encoded, key, (value) => isKindOf(members, value));
}

export function formOf<Form extends Term["form"]>(
  term: Term,
  form: Form,
): FormOf<Form> {
  const isForm = isFormOf(term, form);

  if (!isForm) {
    throw new InterpreterError(
      `The state names the ${term.form} '${term.id}' where the ${form} stands.`,
    );
  }

  return term;
}

function admittedAt<Member extends string>(
  encoded: JsonObject,
  key: string,
  isMember: (value: string) => value is Member,
): Member {
  const value = stringAt(encoded, key);
  const isAdmitted = isMember(value);

  if (!isAdmitted) {
    throw new InterpreterError(
      `The state holds '${value}' at '${key}', which is none of its values.`,
    );
  }

  return value;
}

function checkText(value: JsonValue, key: string): asserts value is string {
  const isText = typeof value === "string";

  if (!isText) {
    throw faultAt(key, "text");
  }
}

function isIndex(value: JsonValue): value is number {
  if (typeof value !== "number") {
    return false;
  }

  const isWhole = Number.isInteger(value) && value >= 0;
  return isWhole;
}

function isKindOf<Kind extends string>(
  kinds: KindSet<Kind>,
  kind: string,
): kind is Kind {
  return Object.hasOwn(kinds, kind);
}

function isFormOf<Form extends Term["form"]>(
  term: Term,
  form: Form,
): term is FormOf<Form> {
  return term.form === form;
}

function faultAt(key: string, kind: string): InterpreterError {
  return new InterpreterError(`The state holds no ${kind} at '${key}'.`);
}
