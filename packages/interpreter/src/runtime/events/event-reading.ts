import type { CloudEvent, JsonValue } from "../../api/index.js";
import type { ReadMode } from "../../standard/index.js";
import { setMembersOf } from "./attributes.js";

const utf8 = new TextEncoder();

const jsonContentType = /^\s*(?:application\/json|[^;]*\+json)\s*(?:;|$)/iu;

export function eventReadAs(event: CloudEvent, read: ReadMode): JsonValue {
  switch (read) {
    case "data":
      return event.data ?? null;
    case "envelope":
      return setMembersOf(event);
    case "raw":
      return rawDataOf(event);
  }
}

function rawDataOf(event: CloudEvent): JsonValue {
  const encoded = event.data_base64;
  const data = event.data;

  if (encoded !== undefined) {
    return encoded;
  }

  if (data === undefined) {
    return null;
  }

  const isText = typeof data === "string" && isTextContent(event);
  const text = isText ? data : JSON.stringify(data);
  const bytes = utf8.encode(text);

  return bytes.toBase64();
}

function isTextContent(event: CloudEvent): boolean {
  const contentType = event.datacontenttype;

  if (typeof contentType !== "string") {
    return false;
  }

  const isJson = jsonContentType.test(contentType);
  return !isJson;
}
