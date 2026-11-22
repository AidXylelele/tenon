import { isJsonArray, isJsonObject } from "../../runtime/index.js";
import type { ExpressionMode } from "../../standard/index.js";
import type {
  Expression,
  Reference,
  TextTemplate,
  ValueTemplate,
} from "../ast/index.js";
import { fieldsOf, itemsOf } from "./parts.js";
import { textOf } from "./scalars.js";
import type { Part } from "./types.js";

const opening = "${";

const closing = "}";

export function embeddedExpressionOf(
  pointer: string,
  text: string,
): Expression | null {
  const trimmed = text.trim();
  const isEmbedded = trimmed.startsWith(opening) && trimmed.endsWith(closing);

  if (!isEmbedded) {
    return null;
  }

  const embedded = trimmed.slice(opening.length, -closing.length);
  const source = embedded.trim();
  const sourceOffset =
    leadingSpaceOf(text) + opening.length + leadingSpaceOf(embedded);

  return { kind: "expression", pointer, source, sourceOffset, mode: "strict" };
}

export function expressionOf(part: Part): Expression {
  const text = textOf(part);
  const expression = embeddedExpressionOf(part.pointer, text);

  return expression ?? wholeTextExpressionOf(part.pointer, text, "strict");
}

export function textTemplateOf(part: Part): TextTemplate {
  switch (part.mode) {
    case "strict":
      return strictTextOf(part);
    case "loose":
      return looseTextOf(part);
  }
}

function strictTextOf(part: Part): TextTemplate {
  const text = textOf(part);
  const expression = embeddedExpressionOf(part.pointer, text);

  if (expression === null) {
    return { kind: "literal", pointer: part.pointer, value: text };
  }

  return expression;
}

function looseTextOf(part: Part): TextTemplate {
  const text = textOf(part);
  const expression = embeddedExpressionOf(part.pointer, text);

  return expression ?? wholeTextExpressionOf(part.pointer, text, "loose");
}

export function valueTemplateOf(part: Part): ValueTemplate {
  const value = part.value;

  if (typeof value === "string") {
    return textTemplateOf(part);
  }

  const isArray = isJsonArray(value);

  if (isArray) {
    return arrayTemplateOf(part);
  }

  const isObject = isJsonObject(value);

  if (isObject) {
    return objectTemplateOf(part);
  }

  return { kind: "literal", pointer: part.pointer, value };
}

export function transformOf(part: Part): ValueTemplate {
  if (typeof part.value === "string") {
    return expressionOf(part);
  }

  return valueTemplateOf(part);
}

export function referenceOf(part: Part): Reference {
  const name = textOf(part);
  return { kind: "reference", pointer: part.pointer, name };
}

function arrayTemplateOf(part: Part): ValueTemplate {
  const items = itemsOf(part).map(valueTemplateOf);
  const literal = items.every(isLiteral);

  if (literal) {
    return { kind: "literal", pointer: part.pointer, value: part.value };
  }

  return { kind: "array", pointer: part.pointer, items };
}

function objectTemplateOf(part: Part): ValueTemplate {
  const entries = fieldsOf(part).map((field) => {
    const template = valueTemplateOf(field.part);
    return [field.name, template] as const;
  });
  const literal = entries.every(([, template]) => isLiteral(template));

  if (literal) {
    return { kind: "literal", pointer: part.pointer, value: part.value };
  }

  const fields = new Map(entries);
  return { kind: "object", pointer: part.pointer, fields };
}

function isLiteral(template: ValueTemplate): boolean {
  return template.kind === "literal";
}

function wholeTextExpressionOf(
  pointer: string,
  text: string,
  mode: ExpressionMode,
): Expression {
  return { kind: "expression", pointer, source: text, sourceOffset: 0, mode };
}

function leadingSpaceOf(text: string): number {
  const started = text.trimStart();
  return text.length - started.length;
}
