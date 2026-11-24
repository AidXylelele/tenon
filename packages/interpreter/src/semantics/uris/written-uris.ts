import type { ExternalSchema, Schema } from "../../syntax/index.js";
import { writtenTextOf } from "../written/index.js";
import type { ImportPlace } from "./types.js";

const noPlaces: readonly ImportPlace[] = [];

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
