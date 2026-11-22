import type { JsonValue } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import {
  type FunctionSymbol,
  type ReadSchema,
  type SemanticModel,
  importedFunctionOf,
  importedUriOf,
} from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import type { ExportSchema, Term } from "../forms/index.js";
import type { Keyed, ProgramSource, SchemaDocument, Sources } from "./types.js";

const noIds: readonly string[] = [];

export function sourcesOf(model: SemanticModel): Sources {
  const written = model.occurrences
    .filter((occurrence) => occurrence.kind === "schema")
    .map(
      (occurrence) => [occurrence.schema.pointer, occurrence.schema] as const,
    );
  const schemas = new Map(written);
  const fetched = Object.entries(model.imports);
  const texts = new Map(fetched);

  return {
    document: model.source.document,
    schemas,
    functions: model.symbols.components.functions,
    importedSchemas: model.symbols.schemas,
    texts,
  };
}

export function schemaDocumentsOf(
  terms: readonly Term[],
  sources: Sources,
): ReadonlyMap<string, SchemaDocument> {
  const ids = terms.flatMap(compiledSchemaIdsOf);
  const entries = ids.map((id) => documentEntryOf(id, sources));

  return new Map(entries);
}

export function programSourceOf(
  terms: readonly Term[],
  sources: Sources,
): ProgramSource {
  const keys = terms.flatMap((term) => importKeysOf(term, sources));
  const distinct = new Set(keys);
  const unique = [...distinct];
  const entries = unique.map((key) => importedTextOf(key, sources.texts));
  const imported = new Map(entries);

  return { document: sources.document, imported };
}

function compiledSchemaIdsOf(term: Term): readonly string[] {
  switch (term.form) {
    case "validate":
    case "export":
      return compiledIdsOf(term.schema);
    case "sequence":
    case "taskList":
    case "task":
    case "let":
    case "guard":
    case "transform":
    case "choose":
    case "loop":
    case "perform":
    case "raise":
    case "handle":
    case "deadline":
    case "parallel":
    case "stream":
    case "extend":
    case "invoke":
      return noIds;
  }
}

function compiledIdsOf(schema: ExportSchema): readonly string[] {
  switch (schema.kind) {
    case "compiled":
      return [schema.id];
    case "unchecked":
    case "fetched":
      return noIds;
  }
}

function importKeysOf(term: Term, sources: Sources): readonly string[] {
  switch (term.form) {
    case "validate":
    case "export":
      return schemaImportsOf(term.schema, sources.schemas);
    case "task":
      return functionImportsOf(term.descriptor.reference, sources.functions);
    case "sequence":
    case "taskList":
    case "let":
    case "guard":
    case "transform":
    case "choose":
    case "loop":
    case "perform":
    case "raise":
    case "handle":
    case "deadline":
    case "parallel":
    case "stream":
    case "extend":
    case "invoke":
      return noIds;
  }
}

function schemaImportsOf(
  schema: ExportSchema,
  schemas: ReadonlyMap<string, ast.Schema>,
): readonly string[] {
  switch (schema.kind) {
    case "compiled": {
      const written = schemaAt(schema.id, schemas);
      return writtenImportsOf(written);
    }
    case "unchecked":
    case "fetched":
      return noIds;
  }
}

function writtenImportsOf(schema: ast.Schema): readonly string[] {
  switch (schema.kind) {
    case "inline":
      return noIds;
    case "external":
      return [uriOf(schema)];
  }
}

function functionImportsOf(
  reference: string,
  functions: ReadonlyMap<string, FunctionSymbol>,
): readonly string[] {
  const holder = importedFunctionOf(reference, functions);

  if (holder === null) {
    return noIds;
  }

  return [holder.name];
}

function importedTextOf(
  key: string,
  texts: ReadonlyMap<string, string>,
): Keyed<string> {
  const text = texts.get(key);

  if (text === undefined) {
    throw new InterpreterError(`The host imported no text for '${key}'.`);
  }

  return [key, text];
}

function documentEntryOf(id: string, sources: Sources): Keyed<SchemaDocument> {
  const document = documentOf(id, sources);
  return [id, document];
}

function documentOf(id: string, sources: Sources): SchemaDocument {
  const schema = schemaAt(id, sources.schemas);

  switch (schema.kind) {
    case "inline":
      return { origin: id, document: schema.document };
    case "external": {
      const uri = uriOf(schema);
      const document = importedDocumentOf(uri, sources.importedSchemas);
      return { origin: uri, document };
    }
  }
}

function schemaAt(
  id: string,
  schemas: ReadonlyMap<string, ast.Schema>,
): ast.Schema {
  const schema = schemas.get(id);

  if (schema === undefined) {
    throw new InterpreterError(`No schema stands at '${id}'.`);
  }

  return schema;
}

function uriOf(schema: ast.ExternalSchema): string {
  const uri = importedUriOf(schema);

  if (uri === null) {
    throw new InterpreterError(
      `The schema at '${schema.pointer}' is read by the run: it has no URI the analysis imported.`,
    );
  }

  return uri;
}

function importedDocumentOf(
  uri: string,
  imported: ReadonlyMap<string, ReadSchema>,
): JsonValue {
  const schema = imported.get(uri);

  if (schema === undefined) {
    throw new InterpreterError(`The analysis read no schema from '${uri}'.`);
  }

  return schema.document;
}
