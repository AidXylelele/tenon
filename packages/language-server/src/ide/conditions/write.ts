import { runtimeExpressionOf, timeExpressions } from "../jq-text/index.js";
import type {
  Comparison,
  Condition,
  ConditionRow,
  ConditionText,
  ContainingRow,
  Join,
  Operand,
  SecondValue,
} from "./interfaces.js";
import { isPathOf } from "./patterns.js";

const joins: Readonly<Record<Join, string>> = { all: " and ", any: " or " };

export const secondValues: Readonly<Record<Comparison, SecondValue>> = {
  is: "operand",
  isNot: "operand",
  contains: "value",
  doesNotContain: "value",
  isEmpty: "none",
  isNotEmpty: "none",
  isGreaterThan: "operand",
  isLessThan: "operand",
};

export function conditionTextOf(condition: Condition): ConditionText {
  const rows = condition.rows;
  const refusals = rows.flatMap(rowRefusalsOf);
  const [refusal] = refusals;
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return { kind: "refused", reason: "A condition holds at least one row." };
  }

  if (refusal !== undefined) {
    return { kind: "refused", reason: refusal };
  }

  const texts = rows.map(rowTextOf);
  const joined = joinedOf(texts, condition.join);
  const text = runtimeExpressionOf(joined);
  return { kind: "text", text };
}

function joinedOf(texts: readonly string[], join: Join): string {
  const [only] = texts;
  const isSingle = texts.length === 1;

  if (isSingle && only !== undefined) {
    return only;
  }

  const bracketed = texts.map((text) => `(${text})`);
  return bracketed.join(joins[join]);
}

function rowRefusalsOf(row: ConditionRow): readonly string[] {
  const paths = pathsOf(row);
  const strays = paths.filter((path) => !isPathOf(path));

  return strays.map((path) => `'${path}' is not a path to data.`);
}

function pathsOf(row: ConditionRow): readonly string[] {
  const right = row.right;

  if (right?.kind !== "data") {
    return [row.left];
  }

  return [row.left, right.path];
}

function rowTextOf(row: ConditionRow): string {
  const left = row.left;

  switch (row.comparison) {
    case "isEmpty":
      return `(${left} | length) == 0`;
    case "isNotEmpty":
      return `(${left} | length) > 0`;
    case "contains":
    case "doesNotContain":
      return containingTextOf(row);
    case "is":
      return comparedTextOf(left, "==", row.right);
    case "isNot":
      return comparedTextOf(left, "!=", row.right);
    case "isGreaterThan":
      return orderedTextOf(left, ">", row.right);
    case "isLessThan":
      return orderedTextOf(left, "<", row.right);
  }
}

function containingTextOf(row: ContainingRow): string {
  const sought = operandTextOf(row.right);
  const inList = `any(.[]; . == ${sought})`;
  const inText = `tostring | contains(${sought} | tostring)`;
  const contained = `${row.left} | if type == "array" then ${inList} else ${inText} end`;

  switch (row.comparison) {
    case "contains":
      return contained;
    case "doesNotContain":
      return `${contained} | not`;
  }
}

function comparedTextOf(left: string, sign: string, right: Operand): string {
  const other = operandTextOf(right);

  return `${left} ${sign} ${other}`;
}

function orderedTextOf(left: string, order: string, right: Operand): string {
  const isNumber = right.kind === "value" && typeof right.value === "number";

  if (!isNumber) {
    return comparedTextOf(left, order, right);
  }

  const number = `(${left} | tonumber)`;
  return comparedTextOf(number, order, right);
}

function operandTextOf(operand: Operand): string {
  switch (operand.kind) {
    case "data":
      return operand.path;
    case "value":
      return JSON.stringify(operand.value);
    case "time":
      return `(${timeExpressions[operand.time]})`;
  }
}
