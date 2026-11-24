import type { JsonValue } from "../../api/index.js";
import { isJsonObject } from "../json/index.js";
import { percentEncodedOf } from "./percent-encoding.js";
import { scalarTextOf } from "./scalar-text.js";
import type { UriTemplate, UriTemplatePart } from "./types.js";

const variables = /\{([^{}]*)\}/;

export function uriTemplateOf(source: string): UriTemplate {
  const pieces = source.split(variables);
  const parts = pieces.map(partOf);
  const written = parts.filter(isWritten);

  return { source, parts: written };
}

export function expandedUriOf(template: UriTemplate, data: JsonValue): string {
  const expanded = template.parts.map((part) => expansionOf(part, data));
  return expanded.join("");
}

function partOf(piece: string, index: number): UriTemplatePart {
  const isName = index % 2 === 1;

  if (isName) {
    return { kind: "variable", name: piece };
  }

  return { kind: "text", text: piece };
}

function isWritten(part: UriTemplatePart): boolean {
  switch (part.kind) {
    case "text":
      return part.text !== "";
    case "variable":
      return true;
  }
}

function expansionOf(part: UriTemplatePart, data: JsonValue): string {
  switch (part.kind) {
    case "text":
      return part.text;
    case "variable": {
      const value = variableOf(data, part.name);
      return valueExpansionOf(value);
    }
  }
}

function variableOf(data: JsonValue, name: string): JsonValue {
  const isObject = isJsonObject(data);

  if (!isObject) {
    return null;
  }

  const present = Object.hasOwn(data, name);

  if (!present) {
    return null;
  }

  return data[name] ?? null;
}

function valueExpansionOf(value: JsonValue): string {
  const text = scalarTextOf(value);

  if (text === null) {
    return "";
  }

  return percentEncodedOf(text);
}
