import type { JsonObject, JsonValue } from "../../../api/index.js";
import type { OptionalPart, Template } from "../../../core/index.js";
import {
  Raised,
  isJsonArray,
  isJsonObject,
  isJsonScalar,
  scalarTextOf,
} from "../../../runtime/index.js";
import {
  readsSecrets,
  requestReader,
  shownValueOf,
  templateValueOf,
} from "../../values/index.js";
import type { Building } from "./building.js";

type NamedText = readonly [string, string];

export function valueOf(template: Template, building: Building): JsonValue {
  const reader = requestReader(building.values, building.view);
  return templateValueOf(template, building.input, reader);
}

export function textOf(template: Template, building: Building): string {
  const value = valueOf(template, building);
  const isText = typeof value === "string";

  if (!isText) {
    throw wrongShapeOf(template, value, "a string");
  }

  return value;
}

export function optionalTextOf(
  part: OptionalPart,
  building: Building,
): string | null {
  switch (part.kind) {
    case "omitted":
      return null;
    case "written":
      return textOf(part.template, building);
  }
}

export function optionalNumberOf(
  part: OptionalPart,
  building: Building,
): number | null {
  switch (part.kind) {
    case "omitted":
      return null;
    case "written":
      return numberOf(part.template, building);
  }
}

function numberOf(template: Template, building: Building): number {
  const value = valueOf(template, building);
  const isNumber = typeof value === "number";

  if (!isNumber) {
    throw wrongShapeOf(template, value, "a number");
  }

  return value;
}

export function textsOf(
  template: Template,
  building: Building,
): readonly string[] {
  const value = valueOf(template, building);
  const isTexts = isTextList(value);

  if (!isTexts) {
    throw wrongShapeOf(template, value, "a list of strings");
  }

  return value;
}

function isTextList(value: JsonValue): value is readonly string[] {
  const isList = isJsonArray(value);

  if (!isList) {
    return false;
  }

  const isTexts = value.every(isString);
  return isTexts;
}

export function entriesOf(template: Template, building: Building): JsonObject {
  const value = valueOf(template, building);
  const isObject = isJsonObject(value);

  if (!isObject) {
    const shown = shownValueOf(template, value);
    const detail = `${shown} is not a map of names to values.`;
    throw Raised.standard("configuration", detail);
  }

  return value;
}

export function scalarTextsOf(
  template: Template,
  building: Building,
): Readonly<Record<string, string>> {
  const entries = scalarEntriesOf(template, building);
  const texts = Object.entries(entries).flatMap(scalarEntryOf);

  return Object.fromEntries(texts);
}

export function scalarEntriesOf(
  template: Template,
  building: Building,
): JsonObject {
  const entries = entriesOf(template, building);
  const unscalar = Object.entries(entries).find(
    ([, value]) => !isJsonScalar(value),
  );

  if (unscalar === undefined) {
    return entries;
  }

  const isRead = readsSecrets(template);

  if (!isRead) {
    return entries;
  }

  const [name] = unscalar;
  const detail = `The value of '${name}' is not a scalar, so it has no text.`;
  throw Raised.standard("expression", detail);
}

export function stdinOf(part: OptionalPart, building: Building): string | null {
  switch (part.kind) {
    case "omitted":
      return null;
    case "written": {
      const value = valueOf(part.template, building);
      return processTextOf(value);
    }
  }
}

export function argumentTextsOf(
  template: Template,
  building: Building,
): readonly string[] {
  const value = valueOf(template, building);
  const isList = isJsonArray(value);

  if (!isList) {
    const shown = shownValueOf(template, value);
    const detail = `${shown} is not a list of values.`;
    throw Raised.standard("configuration", detail);
  }

  return value.map(processTextOf);
}

export function environmentOf(
  template: Template,
  building: Building,
): Readonly<Record<string, string>> {
  const entries = entriesOf(template, building);
  const texts = Object.entries(entries).map(processEntryOf);

  return Object.fromEntries(texts);
}

function scalarEntryOf(
  entry: readonly [string, JsonValue],
): readonly NamedText[] {
  const [name, value] = entry;
  const text = scalarTextOf(value);

  if (text === null) {
    return [];
  }

  return [[name, text]];
}

function processEntryOf(entry: readonly [string, JsonValue]): NamedText {
  const [name, value] = entry;
  const text = processTextOf(value);

  return [name, text];
}

function processTextOf(value: JsonValue): string {
  const isText = typeof value === "string";

  if (isText) {
    return value;
  }

  return JSON.stringify(value);
}

function isString(value: JsonValue): value is string {
  return typeof value === "string";
}

function wrongShapeOf(
  template: Template,
  value: JsonValue,
  shape: string,
): Raised {
  const shown = shownValueOf(template, value);
  const detail = shapeDetailOf(template, shown, shape);

  return Raised.standard("configuration", detail);
}

function shapeDetailOf(
  template: Template,
  shown: string,
  shape: string,
): string {
  switch (template.kind) {
    case "expression":
      return `The expression at ${template.id} yields ${shown}, which is not ${shape}.`;
    case "literal":
    case "object":
    case "array":
    case "current":
    case "context":
      return `${shown} is not ${shape}.`;
  }
}
