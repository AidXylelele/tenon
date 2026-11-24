import type { JsonValue } from "interpreter/front-end";
import type { Problem } from "../snapshot/index.js";

export type DocumentReading =
  | { readonly kind: "document"; readonly document: JsonValue }
  | { readonly kind: "refused"; readonly diagnostics: readonly Problem[] };

export interface NewDocumentParams {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

export type NewDocumentParam = keyof NewDocumentParams;

export type NewDocumentResult =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "refused"; readonly params: readonly NewDocumentParam[] };
