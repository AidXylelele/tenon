import type * as ast from "../../../syntax/index.js";
import {
  type DefaultedEventAttribute,
  type EventAttribute,
  type UriEventAttribute,
  defaultedEventAttributes,
  defaults,
  eventAttributes,
  isMemberOf,
  uriEventAttributes,
} from "../../../standard/index.js";
import {
  type AttributeTemplate,
  type AttributeValue,
  type EmitTemplate,
  attributeTemplate,
  derivedIdValue,
  emitTemplate,
  evaluatedValue,
  literal,
  stepTimeValue,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { uriTermOf, writtenTemplateOf } from "../templates.js";

export function emitTemplateOf(
  written: ast.EventProperties,
  context: Context,
): EmitTemplate {
  const properties = eventAttributes.flatMap((name) =>
    propertyOf(name, written, context),
  );
  const additional = Array.from(written.additional, ([name, template]) =>
    additionalAttributeOf(name, template, context),
  );
  const given = [...properties, ...additional];
  const names = given.map((attribute) => attribute.name);
  const absent = defaultedEventAttributes.filter(
    (name) => !names.includes(name),
  );
  const defaulted = absent.map((name) => defaultOf(name, context));
  const attributes = [...defaulted, ...given];

  return emitTemplate({ attributes });
}

function propertyOf(
  name: EventAttribute,
  written: ast.EventProperties,
  context: Context,
): readonly AttributeTemplate[] {
  const isUri = isMemberOf(uriEventAttributes, name);

  if (isUri) {
    return uriPropertyOf(name, written, context);
  }

  const template = written[name];

  if (template === null) {
    return [];
  }

  const value = evaluatedOf(template, context);
  const attribute = attributeTemplate({ name, value });

  return [attribute];
}

function uriPropertyOf(
  name: UriEventAttribute,
  written: ast.EventProperties,
  context: Context,
): readonly AttributeTemplate[] {
  const template = written[name];

  if (template === null) {
    return [];
  }

  const value = uriValueOf(template, context);
  const attribute = attributeTemplate({ name, value });

  return [attribute];
}

function uriValueOf(
  template: ast.TextTemplate,
  context: Context,
): AttributeValue {
  const uri = uriTermOf(template, context);

  switch (uri.kind) {
    case "uri":
      return uri;
    case "expression":
      return evaluatedValue({ template: uri });
  }
}

function additionalAttributeOf(
  name: string,
  template: ast.ValueTemplate,
  context: Context,
): AttributeTemplate {
  const value = evaluatedOf(template, context);
  return attributeTemplate({ name, value });
}

function evaluatedOf(
  template: ast.ValueTemplate,
  context: Context,
): AttributeValue {
  const translated = writtenTemplateOf(template, context);
  return evaluatedValue({ template: translated });
}

function defaultOf(
  name: DefaultedEventAttribute,
  context: Context,
): AttributeTemplate {
  const value = defaultValueOf(name, context);
  return attributeTemplate({ name, value });
}

function defaultValueOf(
  name: DefaultedEventAttribute,
  context: Context,
): AttributeValue {
  switch (name) {
    case "specversion": {
      const template = literal({ value: defaults.eventSpecversion });
      return evaluatedValue({ template });
    }
    case "id":
      return derivedIdValue;
    case "source": {
      const source = workflowSourceOf(context.model.workflow.document);
      const template = literal({ value: source });
      return evaluatedValue({ template });
    }
    case "time":
      return stepTimeValue;
  }
}

function workflowSourceOf(header: ast.DocumentHeader): string {
  return `/${header.namespace}/${header.name}/${header.version}`;
}
