import { childPointerOf, type SchemaCompiler } from "../../runtime/index.js";
import { isJsonSchemaFormat } from "../../standard/index.js";
import type { Finding, InlineSchema, Schema } from "../../syntax/index.js";
import type { ReadSchema } from "../symbols/index.js";
import type { ImportPlace } from "../uris/index.js";
import type { CheckSubject } from "./types.js";

const none: readonly Finding[] = [];

export function checkJsonSchemas(subject: CheckSubject): readonly Finding[] {
  const compiler = subject.schemas;
  const schemas = subject.occurrences
    .filter((occurrence) => occurrence.kind === "schema")
    .map((occurrence) => occurrence.schema);
  const json = schemas.filter((schema) => isJsonSchemaFormat(schema.format));
  const other = schemas.filter((schema) => !isJsonSchemaFormat(schema.format));
  const inline = json.filter((schema) => schema.kind === "inline");
  const imported = [...subject.symbols.schemas.values()];
  const formats = other.map(schemaFormatOf);
  const written = inline.flatMap((schema) =>
    inlineFindingsOf(schema, compiler),
  );
  const read = imported.flatMap((schema) => importFindingsOf(schema, compiler));

  return [...formats, ...written, ...read];
}

function inlineFindingsOf(
  schema: InlineSchema,
  compiler: SchemaCompiler,
): readonly Finding[] {
  const compilation = compiler.compile(schema.document);

  switch (compilation.kind) {
    case "compiled":
      return none;
    case "invalid":
      return [invalidSchemaOf(schema, compilation.message)];
  }
}

function importFindingsOf(
  schema: ReadSchema,
  compiler: SchemaCompiler,
): readonly Finding[] {
  const compilation = compiler.compile(schema.document);

  switch (compilation.kind) {
    case "compiled":
      return none;
    case "invalid":
      return schema.places.map((place) =>
        invalidImportedSchemaOf(place, compilation.message),
      );
  }
}

function schemaFormatOf(schema: Schema): Finding<"schemaFormat"> {
  return {
    name: "schemaFormat",
    code: "json-schema",
    pointer: childPointerOf(schema.pointer, "format"),
    subject: null,
    details: [schema.format],
    import: null,
  };
}

function invalidSchemaOf(
  schema: InlineSchema,
  problem: string,
): Finding<"invalidSchema"> {
  return {
    name: "invalidSchema",
    code: "json-schema",
    pointer: childPointerOf(schema.pointer, "document"),
    subject: null,
    details: [problem],
    import: null,
  };
}

function invalidImportedSchemaOf(
  place: ImportPlace,
  problem: string,
): Finding<"invalidImportedSchema"> {
  return {
    name: "invalidImportedSchema",
    code: "json-schema",
    pointer: place.pointer,
    subject: place.uri,
    details: [place.uri, problem],
    import: null,
  };
}
