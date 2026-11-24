import { defaults } from "../../standard/index.js";
import type { Export, Input, Output, Schema } from "../ast/index.js";
import { externalResourceOf } from "./endpoints.js";
import { fieldOf, objectFieldOf, optionalAt, requiredAt } from "./parts.js";
import { textOf } from "./scalars.js";
import type { Part } from "./types.js";
import { transformOf } from "./values.js";

export function inputOf(parent: Part): Input {
  const input = objectFieldOf(parent, "input");
  const schema = optionalAt(input, "schema", schemaOf);
  const from = optionalAt(input, "from", transformOf);

  return { pointer: input.pointer, schema, from };
}

export function outputOf(parent: Part): Output {
  return transformationOf(parent, "output");
}

export function exportOf(parent: Part): Export {
  return transformationOf(parent, "export");
}

function transformationOf(parent: Part, name: string): Output | Export {
  const transformation = objectFieldOf(parent, name);
  const schema = optionalAt(transformation, "schema", schemaOf);
  const as = optionalAt(transformation, "as", transformOf);

  return { pointer: transformation.pointer, schema, as };
}

function schemaOf(part: Part): Schema {
  const format = optionalAt(part, "format", textOf) ?? defaults.schemaFormat;
  const document = fieldOf(part, "document");

  if (document !== null) {
    const pointer = part.pointer;
    return { kind: "inline", pointer, format, document: document.value };
  }

  const resource = requiredAt(part, "resource", externalResourceOf);
  return { kind: "external", pointer: part.pointer, format, resource };
}
