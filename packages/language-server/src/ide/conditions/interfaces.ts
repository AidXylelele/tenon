import type { TimeName } from "../jq-text/index.js";

export type Literal = string | number | boolean | null;

export interface ValueOperand {
  readonly kind: "value";
  readonly value: Literal;
}

export type Operand =
  | { readonly kind: "data"; readonly path: string }
  | ValueOperand
  | { readonly kind: "time"; readonly time: TimeName };

export interface EmptinessRow {
  readonly left: string;
  readonly comparison: "isEmpty" | "isNotEmpty";
  readonly right: null;
}

export interface ContainingRow {
  readonly left: string;
  readonly comparison: "contains" | "doesNotContain";
  readonly right: ValueOperand;
}

export interface ComparingRow {
  readonly left: string;
  readonly comparison: "is" | "isNot" | "isGreaterThan" | "isLessThan";
  readonly right: Operand;
}

export type ConditionRow = EmptinessRow | ContainingRow | ComparingRow;

export type Comparison = ConditionRow["comparison"];

export type Join = "all" | "any";

export interface Condition {
  readonly join: Join;
  readonly rows: readonly ConditionRow[];
}

export type ConditionReading =
  | { readonly kind: "condition"; readonly condition: Condition }
  | { readonly kind: "expression" };

export type ConditionText =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "refused"; readonly reason: string };

export interface RowForm {
  readonly pattern: RegExp;
  readonly comparison: Comparison;
}

export interface Bracketed {
  readonly parts: readonly string[];
  readonly joins: readonly string[];
}

export type SecondValue = "none" | "value" | "operand";
