import type {
  Duration,
  Export,
  Input,
  Output,
  Reference,
  Schema,
  ValueTemplate,
} from "../../syntax/index.js";
import { inSchema } from "./contexts.js";
import { resourceOccurrencesOf } from "./endpoints.js";
import type { Context, Occurrence, ReferenceOccurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function templateOccurrencesOf(
  template: ValueTemplate | null,
  context: Context,
): readonly Occurrence[] {
  if (template === null) {
    return none;
  }

  switch (template.kind) {
    case "literal":
      return none;
    case "expression":
      return [{ kind: "expression", expression: template, context }];
    case "object":
      return fieldOccurrencesOf(template.fields, context);
    case "array":
      return template.items.flatMap((item) =>
        templateOccurrencesOf(item, context),
      );
  }
}

export function fieldOccurrencesOf(
  fields: ReadonlyMap<string, ValueTemplate>,
  context: Context,
): readonly Occurrence[] {
  const templates = [...fields.values()];
  return templates.flatMap((template) =>
    templateOccurrencesOf(template, context),
  );
}

export function durationOccurrencesOf(
  duration: Duration | null,
  context: Context,
): readonly Occurrence[] {
  if (duration === null) {
    return none;
  }

  switch (duration.kind) {
    case "fixed":
    case "calendar":
    case "invalid":
      return [{ kind: "duration", duration, context }];
    case "computed":
      return [
        { kind: "duration", duration, context },
        { kind: "expression", expression: duration.expression, context },
      ];
  }
}

export function referenceOccurrencesOf(
  table: ReferenceOccurrence["table"],
  reference: Reference,
  context: Context,
): readonly Occurrence[] {
  return [{ kind: "reference", table, reference, context }];
}

export function retryReferenceOccurrencesOf(
  reference: Reference,
  handler: Context,
  context: Context,
): readonly Occurrence[] {
  return [{ kind: "reference", table: "retries", reference, context, handler }];
}

export function inputOccurrencesOf(
  input: Input,
  context: Context,
): readonly Occurrence[] {
  return [
    ...schemaOccurrencesOf(input.schema, context),
    ...templateOccurrencesOf(input.from, context),
  ];
}

export function outputOccurrencesOf(
  output: Output | Export,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(output.as, context),
    ...schemaOccurrencesOf(output.schema, context),
  ];
}

function schemaOccurrencesOf(
  schema: Schema | null,
  context: Context,
): readonly Occurrence[] {
  if (schema === null) {
    return none;
  }

  switch (schema.kind) {
    case "inline":
      return [{ kind: "schema", schema, context }];
    case "external": {
      const read = inSchema(context, schema);
      return [
        { kind: "schema", schema, context },
        ...resourceOccurrencesOf(schema.resource, read),
      ];
    }
  }
}
