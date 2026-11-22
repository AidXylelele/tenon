import type { JsonObject, JsonValue } from "../../api/index.js";
import {
  childPointerOf,
  isJsonArray,
  isJsonObject,
  rootPointer,
} from "../json/index.js";
import type { SchemaLocation } from "./types.js";

type Located = readonly [node: object, location: SchemaLocation];

export function schemaLocationsOf(
  documents: readonly JsonObject[],
): ReadonlyMap<object, SchemaLocation> {
  const located = documents.flatMap(documentLocationsOf);
  return new Map(located);
}

function documentLocationsOf(document: JsonObject): readonly Located[] {
  const { $id: id = null } = document;

  if (typeof id !== "string") {
    return [];
  }

  return nodeLocationsOf(document, `${id}#`, rootPointer);
}

function nodeLocationsOf(
  value: JsonValue,
  base: string,
  pointer: string,
): readonly Located[] {
  const isList = isJsonArray(value);

  if (isList) {
    return value.flatMap((item, index) => {
      const itemPointer = childPointerOf(pointer, index);
      return nodeLocationsOf(item, base, itemPointer);
    });
  }

  const isNode = isJsonObject(value);

  if (!isNode) {
    return [];
  }

  const location: SchemaLocation = { uri: `${base}${pointer}`, node: value };
  const members = Object.entries(value).flatMap(([name, member]) => {
    const memberPointer = childPointerOf(pointer, name);
    return nodeLocationsOf(member, base, memberPointer);
  });

  return [[value, location], ...members];
}
