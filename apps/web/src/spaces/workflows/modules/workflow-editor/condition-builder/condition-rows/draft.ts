import type {
  Comparison,
  Condition,
  ConditionReading,
  ConditionRow,
  EditAction,
  Join,
  Operand,
} from "language-server/protocol";
import type { DataExport, Draft, DraftOperand, DraftRow } from "./interfaces";
import { literalOf, literalText, secondOf } from "./words";

const NOTHING: DraftOperand = { kind: "none" };

const NO_TEXT: DraftOperand = { kind: "value", text: "" };

function emptyRowOf(id: number): DraftRow {
  return {
    id,
    left: null,
    leftExport: null,
    comparison: "isNotEmpty",
    right: NOTHING,
  };
}

export function draftOf(condition: Condition): Draft {
  const read = condition.rows.map((row, index) => ({
    id: index,
    left: row.left,
    leftExport: null,
    comparison: row.comparison,
    right: operandOf(row.right),
  }));
  const rows = read.length > 0 ? read : [emptyRowOf(0)];

  return { join: condition.join, rows, next: rows.length };
}

function operandOf(right: ConditionRow["right"]): DraftOperand {
  if (right === null) return NOTHING;

  switch (right.kind) {
    case "value":
      return { kind: "value", text: literalText(right.value) };
    case "data":
      return { kind: "data", path: right.path, export: null };
    case "time":
      return { kind: "time", time: right.time };
  }
}

export function conditionOf(draft: Draft): Condition | null {
  const rows = draft.rows.map(rowOf);
  const complete = rows.filter((row) => row !== null);
  const isComplete = complete.length === rows.length && rows.length > 0;

  return isComplete ? { join: draft.join, rows: complete } : null;
}

export function writtenPartOf(draft: Draft): Condition {
  const rows = draft.rows.map(rowOf).filter((row) => row !== null);
  return { join: draft.join, rows };
}

export function rowProblemOf(row: DraftRow): string | null {
  if (row.right.kind !== "value" || secondOf(row.comparison) === "none")
    return null;

  const typed = literalOf(row.right.text, row.comparison);
  const isUntouched = row.right.text === "";

  if (typed.kind === "literal" || isUntouched) return null;

  return typed.reason;
}

function rowOf(row: DraftRow): ConditionRow | null {
  const left = row.left;

  if (left === null) return null;

  switch (row.comparison) {
    case "isEmpty":
    case "isNotEmpty":
      return { left, comparison: row.comparison, right: null };
    case "contains":
    case "doesNotContain": {
      const right = valueOperandOf(row.right, row.comparison);
      return right === null || right.kind !== "value"
        ? null
        : { left, comparison: row.comparison, right };
    }
    case "is":
    case "isNot":
    case "isGreaterThan":
    case "isLessThan": {
      const right = valueOperandOf(row.right, row.comparison);
      return right === null
        ? null
        : { left, comparison: row.comparison, right };
    }
  }
}

function valueOperandOf(
  right: DraftOperand,
  comparison: Comparison,
): Operand | null {
  switch (right.kind) {
    case "none":
      return null;
    case "data":
      return right.path === null ? null : { kind: "data", path: right.path };
    case "time":
      return { kind: "time", time: right.time };
    case "value": {
      const typed = literalOf(right.text, comparison);
      return typed.kind === "literal"
        ? { kind: "value", value: typed.value }
        : null;
    }
  }
}

function changedRowOf(
  draft: Draft,
  id: number,
  change: (row: DraftRow) => DraftRow,
): Draft {
  const rows = draft.rows.map((row) => (row.id === id ? change(row) : row));
  return { ...draft, rows };
}

export function withRowAdded(draft: Draft): Draft {
  const row = emptyRowOf(draft.next);
  const rows = draft.rows.concat([row]);
  return { ...draft, rows, next: draft.next + 1 };
}

export function withRowRemoved(draft: Draft, id: number): Draft {
  const kept = draft.rows.filter((row) => row.id !== id);

  if (kept.length > 0) return { ...draft, rows: kept };

  return { ...draft, rows: [emptyRowOf(draft.next)], next: draft.next + 1 };
}

export function withLeft(
  draft: Draft,
  id: number,
  left: string,
  exported: DataExport | null,
): Draft {
  return changedRowOf(draft, id, (row) => ({
    ...row,
    left,
    leftExport: exported,
  }));
}

export function withComparison(
  draft: Draft,
  id: number,
  comparison: Comparison,
): Draft {
  return changedRowOf(draft, id, (row) => {
    const right = adaptedOf(row.right, comparison);
    return { ...row, comparison, right };
  });
}

function adaptedOf(right: DraftOperand, comparison: Comparison): DraftOperand {
  switch (secondOf(comparison)) {
    case "none":
      return NOTHING;
    case "value":
      return right.kind === "value" ? right : NO_TEXT;
    case "operand":
      return right.kind === "none" ? NO_TEXT : right;
  }
}

export function withRight(
  draft: Draft,
  id: number,
  right: DraftOperand,
): Draft {
  return changedRowOf(draft, id, (row) => ({ ...row, right }));
}

export function withJoin(draft: Draft, join: Join): Draft {
  return { ...draft, join };
}

export function editsOf(pointer: string, draft: Draft): EditAction[] {
  const condition = conditionOf(draft);

  if (condition === null) return [];

  const exports = draft.rows.flatMap(exportsOf);
  const uses: EditAction[] = exports.map((exported) => ({
    kind: "useData",
    pointer,
    value: exported.value,
    export: exported.step,
  }));
  const setting: EditAction = { kind: "setCondition", pointer, condition };

  return uses.concat([setting]);
}

function exportsOf(row: DraftRow): DataExport[] {
  const right = row.right.kind === "data" ? row.right.export : null;
  const both = [row.leftExport, right];

  return both.filter((exported) => exported !== null);
}

export function holdsReading(draft: Draft, reading: ConditionReading): boolean {
  if (reading.kind === "expression") return false;

  const written = writtenPartOf(draft);
  return JSON.stringify(written) === JSON.stringify(reading.condition);
}
