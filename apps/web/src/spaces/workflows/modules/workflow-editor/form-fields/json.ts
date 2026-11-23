import type { FormField } from "language-server/protocol";

export type Json = FormField["value"];

export type JsonObject = { readonly [key: string]: Json };

export function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
