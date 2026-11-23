import type { EditAction } from "language-server/protocol";
import type { FieldState, SendAs } from "./interfaces";
import { isObject, type JsonObject } from "./json";

const CONTENT_TYPE = "content-type";

const FORM_TYPE = "application/x-www-form-urlencoded";

const FORM_HEADER = "Content-Type";

export const SEND_AS_CHOICES: readonly {
  readonly sendAs: SendAs;
  readonly text: string;
}[] = [
  { sendAs: "message", text: "Message" },
  { sendAs: "json", text: "JSON" },
  { sendAs: "form", text: "Form fields" },
];

export function sendAsOf(body: FieldState, headers: FieldState): SendAs {
  if (sendsForm(headers)) return "form";

  if (body.value === null || isMessage(body)) return "message";

  return "json";
}

export function sendAsEditsOf(
  body: FieldState,
  headers: FieldState,
  chosen: SendAs,
): EditAction[] {
  const current = sendAsOf(body, headers);

  if (chosen === current) return [];

  const leaving = current === "form" ? unformedOf(headers) : [];

  switch (chosen) {
    case "message":
      return leaving.concat([setOf(body, { text: "" })]);
    case "json": {
      const emptied = current === "message" ? [setOf(body, {})] : [];
      return leaving.concat(emptied);
    }
    case "form":
      return formedOf(body, headers);
  }
}

function isMessage(body: FieldState): boolean {
  if (!isObject(body.value)) return false;

  const keys = Object.keys(body.value);
  const isText = typeof body.value.text === "string";
  return isText && keys.length === 1;
}

function sendsForm(headers: FieldState): boolean {
  const entries = isObject(headers.value) ? Object.entries(headers.value) : [];

  return entries.some(
    ([name, value]) =>
      name.toLowerCase() === CONTENT_TYPE && value === FORM_TYPE,
  );
}

function formedOf(body: FieldState, headers: FieldState): EditAction[] {
  const named = isObject(headers.value) ? headers.value : {};
  const value = { ...named, [FORM_HEADER]: FORM_TYPE };
  const header = setOf(headers, value);
  const objectBody = isObject(body.value) ? [] : [setOf(body, {})];

  return [header].concat(objectBody);
}

function unformedOf(headers: FieldState): EditAction[] {
  const named = isObject(headers.value) ? headers.value : {};
  const kept = Object.entries(named).filter(
    ([name]) => name.toLowerCase() !== CONTENT_TYPE,
  );

  if (kept.length === 0)
    return [{ kind: "clearField", pointer: headers.pointer }];

  const value = Object.fromEntries(kept);
  return [setOf(headers, value)];
}

function setOf(field: FieldState, value: JsonObject): EditAction {
  return { kind: "setField", pointer: field.pointer, value };
}
