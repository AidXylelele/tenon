import { importedUriOf } from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type SchemaTerm,
  compiledSchema,
  fetchedSchema,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { resourceTemplateOf } from "./effects/index.js";

export function schemaOf(schema: ast.Schema, context: Context): SchemaTerm {
  switch (schema.kind) {
    case "inline":
      return compiledSchema({ id: schema.pointer });
    case "external":
      return externalSchemaOf(schema, context);
  }
}

function externalSchemaOf(
  schema: ast.ExternalSchema,
  context: Context,
): SchemaTerm {
  const imported = importedUriOf(schema);

  if (imported !== null) {
    return compiledSchema({ id: schema.pointer });
  }

  const resource = resourceTemplateOf(schema.resource, context);
  return fetchedSchema({ id: schema.pointer, resource });
}
