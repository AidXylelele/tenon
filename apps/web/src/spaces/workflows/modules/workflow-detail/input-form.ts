import type { EditAction, FormField } from "language-server/protocol";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import type { Problem } from "@/libs/data-access/problem";
import type { InputSchema } from "@/libs/data-access/types";
import { isObject, type JsonObject, type JsonValue } from "@/libs/json/json";
import { keysOf, pointerOf } from "@/libs/json/pointer";

const JSON_SCHEMA = "json";
const INPUT = "/input";
const NOWHERE = { line: 0, character: 0 };

const INPUTS: Readonly<Record<string, FormField["input"]>> = {
  string: "text",
  number: "number",
  integer: "number",
};

const BOOLEANS: readonly JsonValue[] = [true, false];

const CONSTRAINTS = [
  "$ref",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "const",
  "enum",
  "dependentRequired",
  "dependentSchemas",
  "patternProperties",
  "propertyNames",
  "unevaluatedProperties",
  "minProperties",
  "maxProperties",
];

export function inputFieldsOf(
  schema: InputSchema | null,
  value: JsonObject,
  refusals: ReadonlyMap<string, string>,
): readonly FormField[] | null {
  if (schema === null || schema.format !== JSON_SCHEMA) return null;

  const document = schema.document;

  if (!isObject(document) || !isFormable(document)) return null;

  const fields = fieldsOf(document, value, [], refusals);
  return fields.length === 0 ? null : fields;
}

export function refusalsOf(
  problem: Problem | null,
): ReadonlyMap<string, string> {
  const located = (problem?.errors ?? []).filter((error) =>
    error.pointer.startsWith(`${INPUT}/`),
  );
  const entries = located.map(
    (error) => [error.pointer.slice(INPUT.length), error.detail] as const,
  );
  return new Map(entries);
}

export function unplacedOf(
  problem: Problem,
  fields: readonly FormField[] | null,
): Problem {
  const placed = new Set(pointersOf(fields ?? []));
  const errors = problem.errors.filter((error) => {
    const inside = error.pointer.startsWith(`${INPUT}/`);
    return !inside || !placed.has(error.pointer.slice(INPUT.length));
  });
  return { ...problem, errors };
}

function pointersOf(fields: readonly FormField[]): string[] {
  return fields.flatMap((field) => [
    field.pointer,
    ...pointersOf(field.fields),
  ]);
}

export function inputAfter(value: JsonObject, action: EditAction): JsonObject {
  if (action.kind !== "setField" && action.kind !== "clearField") return value;

  const path = keysOf(action.pointer);
  const written = action.kind === "setField" ? action.value : undefined;
  return withValueAt(value, path, written);
}

function isFormable(schema: JsonObject): boolean {
  const properties = schema.properties;

  if (!isObject(properties)) return false;

  const typed = schema.type === undefined || schema.type === "object";
  const constrained = CONSTRAINTS.some((key) => key in schema);
  const extra = schema.additionalProperties;
  const open = extra !== undefined && extra !== false;
  const required = Array.isArray(schema.required) ? schema.required : [];
  const unlisted = required.some(
    (name) => typeof name !== "string" || !(name in properties),
  );
  return typed && !constrained && !open && !unlisted;
}

function fieldsOf(
  schema: JsonObject,
  value: JsonObject,
  at: readonly string[],
  refusals: ReadonlyMap<string, string>,
): FormField[] {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const listed = Array.isArray(schema.required) ? schema.required : [];
  const required = listed.filter((name) => typeof name === "string");
  return Object.entries(properties).flatMap(([key, property]) => {
    if (!isObject(property)) return [];

    const path = [...at, key];
    const needed = required.includes(key);
    return [fieldOf(path, property, needed, value[key], refusals)];
  });
}

function fieldOf(
  path: readonly string[],
  property: JsonObject,
  required: boolean,
  written: JsonValue | undefined,
  refusals: ReadonlyMap<string, string>,
): FormField {
  const boolean = property.type === "boolean";
  const listed = Array.isArray(property.enum) ? property.enum : [];
  const choices = boolean ? BOOLEANS : listed;
  const nested = isObject(property.properties) && isFormable(property);
  const inner = isObject(written) ? written : {};
  const fields = nested ? fieldsOf(property, inner, path, refusals) : [];
  const key = path.at(-1) ?? "";
  const pointer = pointerOf(path);
  const refused = refusals.get(pointer);
  const diagnostics = refused === undefined ? [] : [refusalOf(refused)];
  return {
    key,
    title: textOf(property.title) ?? key,
    pointer,
    section: "data",
    description: textOf(property.description),
    input: inputOf(property, choices, nested),
    choices,
    required,
    written: written !== undefined,
    value: written ?? null,
    fields,
    diagnostics,
  };
}

function refusalOf(message: string): Diagnostic {
  const range = { start: NOWHERE, end: NOWHERE };
  return { range, severity: DiagnosticSeverity.Error, message };
}

function inputOf(
  property: JsonObject,
  choices: readonly JsonValue[],
  nested: boolean,
): FormField["input"] {
  if (choices.length > 0) return "choice";

  if (nested) return "group";

  const type = typeof property.type === "string" ? property.type : "";
  return INPUTS[type] ?? "structured";
}

function withValueAt(
  value: JsonObject,
  path: readonly string[],
  written: JsonValue | undefined,
): JsonObject {
  const key = path[0];

  if (key === undefined) return value;

  const rest = path.slice(1);
  const entries = Object.entries(value).filter(([name]) => name !== key);
  const kept = Object.fromEntries(entries);

  if (rest.length > 0) {
    const current = value[key];
    const inner = isObject(current) ? current : {};
    return { ...kept, [key]: withValueAt(inner, rest, written) };
  }

  if (written === undefined) return kept;

  return { ...kept, [key]: written };
}

function textOf(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
