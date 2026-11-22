import type {
  Expression,
  ExternalSchema,
  Schema,
  TextTemplate,
} from "../../syntax/index.js";
import type { ImportPlace } from "./types.js";

const noPlaces: readonly ImportPlace[] = [];

export function writtenTextOf(template: TextTemplate): string | null {
  switch (template.kind) {
    case "literal":
      return template.value;
    case "expression":
      return looseTextOf(template);
  }
}

export function importedUriOf(schema: ExternalSchema): string | null {
  const written = writtenTextOf(schema.resource.endpoint.uri);

  if (written === null) {
    return null;
  }

  const isTemplate = written.includes("{");

  if (isTemplate) {
    return null;
  }

  return written;
}

export function importPlacesOf(schema: Schema): readonly ImportPlace[] {
  switch (schema.kind) {
    case "inline":
      return noPlaces;
    case "external":
      return externalPlacesOf(schema);
  }
}

function externalPlacesOf(schema: ExternalSchema): readonly ImportPlace[] {
  const uri = importedUriOf(schema);
  const pointer = schema.resource.endpoint.uri.pointer;

  if (uri === null) {
    return noPlaces;
  }

  return [{ uri, pointer }];
}

function looseTextOf(expression: Expression): string | null {
  switch (expression.mode) {
    case "strict":
      return null;
    case "loose":
      return expression.source;
  }
}
