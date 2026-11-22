import type { Comparison, Join, Literal } from "language-server/protocol";

export type TimeName = "now" | "today" | "yesterday";

export type SecondValue = "none" | "value" | "operand";

export interface ComparisonWords {
  readonly comparison: Comparison;
  readonly words: string;
  readonly second: SecondValue;
}

export type DraftOperand =
  | { readonly kind: "none" }
  | { readonly kind: "value"; readonly text: string }
  | { readonly kind: "data"; readonly path: string | null }
  | { readonly kind: "time"; readonly time: TimeName };

export interface DraftRow {
  readonly id: number;
  readonly left: string | null;
  readonly comparison: Comparison;
  readonly right: DraftOperand;
}

export interface DataExport {
  readonly step: string;
  readonly value: string;
}

export interface Draft {
  readonly join: Join;
  readonly rows: readonly DraftRow[];
  readonly next: number;
  readonly exports: readonly DataExport[];
}

export type Typed =
  | { readonly kind: "literal"; readonly value: Literal }
  | { readonly kind: "refused"; readonly reason: string };
