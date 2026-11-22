import type { JsonArray, JsonObject, JsonValue } from "../../api/index.js";
import type {
  ArrayTemplate,
  Expression,
  ObjectTemplate,
  Template,
} from "../../core/index.js";
import { Raised, isJsonArray } from "../../runtime/index.js";
import type { Here } from "../registers/index.js";
import type { View } from "../view.js";
import { contextOf } from "./arguments.js";
import {
  type RequestValues,
  evaluatedValueOf,
  expressionValueOf,
} from "./expressions.js";

export interface TemplateReader {
  readonly context: JsonValue;
  expressionValueOf(expression: Expression, input: JsonValue): JsonValue;
}

export function templateValueOf(
  template: Template,
  input: JsonValue,
  reader: TemplateReader,
): JsonValue {
  switch (template.kind) {
    case "literal":
      return template.value;
    case "expression":
      return reader.expressionValueOf(template, input);
    case "object":
      return objectValueOf(template, input, reader);
    case "array":
      return arrayValueOf(template, input, reader);
    case "current":
      return input;
    case "context":
      return reader.context;
  }
}

export function directReader(here: Here, view: View): TemplateReader {
  const context = contextOf(view);

  return {
    context,
    expressionValueOf: (expression, input) => {
      const at: Here = { scope: here.scope, value: input };
      return expressionValueOf(expression, at, view);
    },
  };
}

export function requestReader(
  values: RequestValues,
  view: View,
): TemplateReader {
  const context = contextOf(view);

  return {
    context,
    expressionValueOf: (expression) => evaluatedValueOf(values, expression),
  };
}

export function itemsOf(collection: JsonValue): JsonArray {
  const isArray = isJsonArray(collection);

  if (!isArray) {
    const shown = JSON.stringify(collection);
    const detail = `A for iterates ${shown}, no array.`;
    throw Raised.standard("configuration", detail);
  }

  return collection;
}

function objectValueOf(
  template: ObjectTemplate,
  input: JsonValue,
  reader: TemplateReader,
): JsonObject {
  const entries = Array.from(template.fields, ([name, field]) => {
    const value = templateValueOf(field, input, reader);
    return [name, value] as const;
  });

  return Object.fromEntries(entries);
}

function arrayValueOf(
  template: ArrayTemplate,
  input: JsonValue,
  reader: TemplateReader,
): JsonArray {
  return template.items.map((item) => templateValueOf(item, input, reader));
}
