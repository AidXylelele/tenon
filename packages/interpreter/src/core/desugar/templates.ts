import type { JsonValue } from "../../api/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type OptionalPart,
  type Template,
  type UriTerm,
  arrayTemplate,
  literal,
  objectTemplate,
  omittedPart,
  uriTemplateTerm,
  writtenPart,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { expressionOf } from "./expressions.js";

export function templateOf(
  template: ast.ValueTemplate | null,
  neutral: JsonValue,
  context: Context,
): Template {
  if (template === null) {
    return literal({ value: neutral });
  }

  return writtenTemplateOf(template, context);
}

export function optionalPartOf(
  template: ast.ValueTemplate | null,
  context: Context,
): OptionalPart {
  if (template === null) {
    return omittedPart;
  }

  const written = writtenTemplateOf(template, context);
  return writtenPart({ template: written });
}

export function optionalLiteralOf(value: string | number | null): OptionalPart {
  if (value === null) {
    return omittedPart;
  }

  const written = literal({ value });
  return writtenPart({ template: written });
}

export function uriTermOf(
  written: ast.TextTemplate,
  context: Context,
): UriTerm {
  switch (written.kind) {
    case "literal":
      return uriTemplateTerm({ source: written.value });
    case "expression":
      return expressionUriOf(written, context);
  }
}

function expressionUriOf(written: ast.Expression, context: Context): UriTerm {
  const translated = expressionOf(written, context);

  switch (translated.kind) {
    case "expression":
      return translated;
    case "literal":
      return uriTemplateTerm({ source: written.source });
  }
}

export function writtenTemplateOf(
  template: ast.ValueTemplate,
  context: Context,
): Template {
  switch (template.kind) {
    case "literal":
      return literal({ value: template.value });
    case "expression":
      return expressionOf(template, context);
    case "object":
      return objectTemplateOf(template, context);
    case "array":
      return arrayTemplateOf(template, context);
  }
}

function objectTemplateOf(
  template: ast.ObjectTemplate,
  context: Context,
): Template {
  const fields = fieldsOf(template.fields, context);
  return objectTemplate({ fields });
}

function fieldsOf(
  fields: ReadonlyMap<string, ast.ValueTemplate>,
  context: Context,
): ReadonlyMap<string, Template> {
  const written = [...fields];
  const entries = written.map(([name, field]) => fieldOf(name, field, context));

  return new Map(entries);
}

function fieldOf(
  name: string,
  field: ast.ValueTemplate,
  context: Context,
): readonly [string, Template] {
  const template = writtenTemplateOf(field, context);
  return [name, template];
}

function arrayTemplateOf(
  template: ast.ArrayTemplate,
  context: Context,
): Template {
  const items = template.items.map((item) => writtenTemplateOf(item, context));
  return arrayTemplate({ items });
}
