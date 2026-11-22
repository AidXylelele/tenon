import type { JsonObject, JsonValue } from "../../api/index.js";
import { percentEncodedOf } from "./percent-encoding.js";
import { scalarTextOf } from "./scalar-text.js";

export function queriedUriOf(uri: string, query: JsonObject): string {
  const entries = Object.entries(query).flatMap(([name, value]) =>
    queryEntriesOf(name, value),
  );

  if (entries.length === 0) {
    return uri;
  }

  const hash = uri.indexOf("#");
  const end = hash === -1 ? uri.length : hash;
  const address = uri.slice(0, end);
  const fragment = uri.slice(end);

  const queried = address.includes("?");
  const separator = queried ? "&" : "?";
  const appended = entries.join("&");

  return `${address}${separator}${appended}${fragment}`;
}

function queryEntriesOf(name: string, value: JsonValue): readonly string[] {
  const text = scalarTextOf(value);

  if (text === null) {
    return [];
  }

  const encodedName = percentEncodedOf(name);
  const encodedValue = percentEncodedOf(text);

  return [`${encodedName}=${encodedValue}`];
}
