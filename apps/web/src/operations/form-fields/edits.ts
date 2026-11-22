import type { EditAction, FormField } from "language-server/protocol";
import type { Commit, FieldState } from "./interfaces";

type Json = FormField["value"];

const EXPRESSION_START = "${";

const REFUSED_JSON = "Write the value as JSON, or as an expression in ${ }.";

const REFUSED_EMPTY = "This field needs a value.";

const REFUSED_NUMBER = "Write a number.";

export function textEditsOf(field: FieldState, text: string): EditAction[] {
  if (text === "") return emptiedOf(field);

  if (text === field.value) return [];

  return [{ kind: "setField", pointer: field.pointer, value: text }];
}

export function valueEditsOf(field: FieldState, value: Json): EditAction[] {
  const before = JSON.stringify(field.value);
  const after = JSON.stringify(value);

  if (field.written && before === after) return [];

  return [{ kind: "setField", pointer: field.pointer, value }];
}

export function clearEditsOf(field: FieldState): EditAction[] {
  if (!field.written) return [];

  return [{ kind: "clearField", pointer: field.pointer }];
}

function emptiedOf(field: FieldState): EditAction[] {
  if (field.required && field.value === "") return [];

  if (field.required)
    return [{ kind: "setField", pointer: field.pointer, value: "" }];

  return clearEditsOf(field);
}

export function numberCommitOf(field: FieldState, text: string): Commit {
  const trimmed = text.trim();

  if (trimmed === "") return { kind: "edits", edits: clearEditsOf(field) };

  const value = Number(trimmed);

  if (Number.isNaN(value)) return { kind: "refused", reason: REFUSED_NUMBER };

  const edits = valueEditsOf(field, value);
  return { kind: "edits", edits };
}

export function jsonCommitOf(field: FieldState, text: string): Commit {
  const trimmed = text.trim();

  if (trimmed === "" && field.required)
    return { kind: "refused", reason: REFUSED_EMPTY };

  if (trimmed === "") return { kind: "edits", edits: clearEditsOf(field) };

  if (trimmed.startsWith(EXPRESSION_START)) {
    const edits = valueEditsOf(field, trimmed);
    return { kind: "edits", edits };
  }

  const value = parsedOf(trimmed);

  if (value === undefined) return { kind: "refused", reason: REFUSED_JSON };

  const edits = valueEditsOf(field, value);
  return { kind: "edits", edits };
}

function parsedOf(text: string): Json | undefined {
  try {
    const value: Json = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

export function jsonTextOf(value: Json): string {
  if (value === null) return "";

  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}

export function dataUseOf(
  pointer: string,
  value: string,
  exported: string | null,
): EditAction[] {
  return [{ kind: "useData", pointer, value, export: exported }];
}
