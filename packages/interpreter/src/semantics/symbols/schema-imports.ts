import type { Imports } from "../../api/index.js";
import { isJsonSchemaFormat } from "../../standard/index.js";
import { type Finding, readSource } from "../../syntax/index.js";
import type { Occurrence } from "../occurrences/index.js";
import { type ImportPlace, importPlacesOf } from "../uris/index.js";
import type {
  ImportedSchema,
  ReadSchema,
  SchemaEntry,
  SchemaLinking,
  SchemaReading,
} from "./types.js";

const none: readonly Finding[] = [];
const unread: readonly SchemaEntry[] = [];
const unfetched: SchemaReading = { kind: "unfetched" };
const unreadable: SchemaReading = { kind: "unreadable" };

export function schemaImportsOf(
  occurrences: readonly Occurrence[],
  imports: Imports,
): SchemaLinking {
  const places = occurrences
    .filter((occurrence) => occurrence.kind === "schema")
    .map((occurrence) => occurrence.schema)
    .filter((schema) => isJsonSchemaFormat(schema.format))
    .flatMap(importPlacesOf);
  const texts = Object.entries(imports);
  const fetched = new Map(texts);
  const grouped = Map.groupBy(places, ({ uri }) => uri);
  const byUri = [...grouped];
  const imported = byUri.map(([uri, named]) => {
    const reading = readingOf(uri, fetched);
    return { uri, places: named, reading };
  });
  const documents = imported.flatMap(readSchemaEntriesOf);
  const schemas = new Map(documents);
  const findings = imported.flatMap(importFindingsOf);

  return { schemas, findings };
}

function readingOf(
  uri: string,
  fetched: ReadonlyMap<string, string>,
): SchemaReading {
  const text = fetched.get(uri);

  if (text === undefined) {
    return unfetched;
  }

  const reading = readSource(text);

  switch (reading.kind) {
    case "unreadable":
      return unreadable;
    case "read":
      return { kind: "read", document: reading.source.document };
  }
}

function readSchemaEntriesOf(imported: ImportedSchema): readonly SchemaEntry[] {
  const { uri, places, reading } = imported;

  switch (reading.kind) {
    case "unfetched":
    case "unreadable":
      return unread;
    case "read": {
      const schema: ReadSchema = { places, document: reading.document };
      return [[uri, schema]];
    }
  }
}

function importFindingsOf(imported: ImportedSchema): readonly Finding[] {
  switch (imported.reading.kind) {
    case "unfetched":
      return imported.places.map(unresolvedImportOf);
    case "unreadable":
      return imported.places.map(importNotSchemaOf);
    case "read":
      return none;
  }
}

function unresolvedImportOf(place: ImportPlace): Finding<"unresolvedImport"> {
  const uri = place.uri;

  return {
    name: "unresolvedImport",
    code: "unresolved-import",
    pointer: place.pointer,
    subject: uri,
    details: [uri],
    import: { reference: uri, uri },
  };
}

function importNotSchemaOf(place: ImportPlace): Finding<"importNotSchema"> {
  return {
    name: "importNotSchema",
    code: "invalid-import",
    pointer: place.pointer,
    subject: place.uri,
    details: [place.uri],
    import: null,
  };
}
