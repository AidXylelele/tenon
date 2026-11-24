import type { JsonValue, Position, Range } from "../../api/index.js";
import type { Finding } from "../findings.js";

export interface PointerAt {
  readonly pointer: string;
  readonly part: "key" | "value";
}

export interface RangeLocator {
  rangeOf(pointer: string): Range | null;
  pointerAt(position: Position): PointerAt | null;
  keyRangeOf(pointer: string): Range | null;
  itemRangeOf(pointer: string): Range | null;
}

export interface SourceDocument {
  readonly document: JsonValue;
  readonly positions: RangeLocator | null;
}

interface Unreadable {
  readonly kind: "unreadable";
  readonly finding: Finding;
  readonly range: Range | null;
}

export type Reading =
  { readonly kind: "read"; readonly source: SourceDocument } | Unreadable;
