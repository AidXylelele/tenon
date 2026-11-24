import { type TimeName, timeExpressions } from "../jq-text/index.js";
import type {
  Bracketed,
  ComparingRow,
  Condition,
  ConditionReading,
  ConditionRow,
  ContainingRow,
  Join,
  Literal,
  Operand,
  RowForm,
} from "./interfaces.js";
import {
  isLiteralOf,
  isPathOf,
  literalSource,
  operandSource,
  pathSource,
  textSource,
} from "./patterns.js";
import { conditionTextOf } from "./write.js";

const unwritten: ConditionReading = {
  kind: "condition",
  condition: { join: "all", rows: [] },
};

const opening = "${ ";

const closing = " }";

const delimiters = /"(?:[^"\\]|\\.)*"|[()]/g;

const joinWords: ReadonlyMap<string, Join> = new Map([
  [" and ", "all"],
  [" or ", "any"],
]);

const path = `(${pathSource})`;

const operand = `(${operandSource})`;

const literal = `(${literalSource})`;

const text = `(${textSource})`;

const contained = String.raw`${path} \| if type == "array" then any\(\.\[\]; \. == ${literal}\) elif type == "string" then contains\(${text}\) else false end`;

const rowForms: readonly RowForm[] = [
  {
    pattern: wholeOf(
      String.raw`${path} \| \. == null or \. == "" or \. == \[\] or \. == \{\}`,
    ),
    comparison: "isEmpty",
  },
  {
    pattern: wholeOf(
      String.raw`${path} \| \. != null and \. != "" and \. != \[\] and \. != \{\}`,
    ),
    comparison: "isNotEmpty",
  },
  { pattern: wholeOf(contained), comparison: "contains" },
  {
    pattern: wholeOf(String.raw`${contained} \| not`),
    comparison: "doesNotContain",
  },
  { pattern: wholeOf(`${path} == ${operand}`), comparison: "is" },
  { pattern: wholeOf(`${path} != ${operand}`), comparison: "isNot" },
  {
    pattern: wholeOf(
      String.raw`try \(\(${path} \| tonumber\) > ${operand}\) catch false`,
    ),
    comparison: "isGreaterThan",
  },
  { pattern: wholeOf(`${path} > ${operand}`), comparison: "isGreaterThan" },
  {
    pattern: wholeOf(
      String.raw`try \(\(${path} \| tonumber\) < ${operand}\) catch false`,
    ),
    comparison: "isLessThan",
  },
  { pattern: wholeOf(`${path} < ${operand}`), comparison: "isLessThan" },
];

export function conditionOf(text: string): ConditionReading {
  if (text === "") {
    return unwritten;
  }

  const isWrapped = text.startsWith(opening) && text.endsWith(closing);

  if (!isWrapped) {
    return expressionOf(text);
  }

  const inner = text.slice(opening.length, -closing.length);
  const condition = conditionInOf(inner);

  if (condition === null) {
    return expressionOf(text);
  }

  const written = conditionTextOf(condition);
  const isCanonical = written.kind === "text" && written.text === text;

  if (!isCanonical) {
    return expressionOf(text);
  }

  return { kind: "condition", condition };
}

function expressionOf(text: string): ConditionReading {
  return { kind: "expression", text };
}

function conditionInOf(inner: string): Condition | null {
  const bracketed = bracketedFrom(inner, 0, { parts: [], joins: [] });

  if (bracketed === null) {
    return singleConditionOf(inner);
  }

  const join = joinOf(bracketed.joins);
  const read = bracketed.parts.map(rowOf);
  const rows = read.filter((row) => row !== null);
  const isWhole = rows.length === read.length;

  if (join === null || !isWhole) {
    return null;
  }

  return { join, rows };
}

function singleConditionOf(inner: string): Condition | null {
  const row = rowOf(inner);

  if (row === null) {
    return null;
  }

  return { join: "all", rows: [row] };
}

function bracketedFrom(
  text: string,
  start: number,
  found: Bracketed,
): Bracketed | null {
  const isOpening = text.charAt(start) === "(";
  const close = isOpening ? closingOf(text, start) : null;

  if (close === null) {
    return null;
  }

  const part = text.slice(start + 1, close);
  const parts = [...found.parts, part];
  const next = close + 1;

  if (next === text.length) {
    return { parts, joins: found.joins };
  }

  const words = [...joinWords.keys()];
  const join = words.find((word) => text.startsWith(word, next));

  if (join === undefined) {
    return null;
  }

  const joins = [...found.joins, join];
  const after = next + join.length;
  return bracketedFrom(text, after, { parts, joins });
}

function closingOf(text: string, open: number): number | null {
  const tail = text.slice(open);
  const marks = [...tail.matchAll(delimiters)];
  const parens = marks.filter((mark) => mark[0] === "(" || mark[0] === ")");
  const closing = closingAt(parens, 0, 0);

  if (closing === null) {
    return null;
  }

  return open + closing.index;
}

function closingAt(
  marks: readonly RegExpExecArray[],
  index: number,
  depth: number,
): RegExpExecArray | null {
  const mark = marks[index];

  if (mark === undefined) {
    return null;
  }

  const step = mark[0] === "(" ? 1 : -1;
  const reached = depth + step;

  if (reached === 0) {
    return mark;
  }

  return closingAt(marks, index + 1, reached);
}

function joinOf(words: readonly string[]): Join | null {
  const joins = words.map((word) => joinWords.get(word) ?? null);
  const [first = "all"] = joins;
  const isUniform = joins.every((join) => join === first);

  return isUniform ? first : null;
}

function rowOf(text: string): ConditionRow | null {
  const rows = rowForms.map((form) => formRowOf(form, text));

  return rows.find((row) => row !== null) ?? null;
}

function formRowOf(form: RowForm, text: string): ConditionRow | null {
  const found = form.pattern.exec(text);

  if (found === null) {
    return null;
  }

  const [left, right] = found.slice(1);
  const comparison = form.comparison;

  if (left === undefined) {
    return null;
  }

  switch (comparison) {
    case "isEmpty":
    case "isNotEmpty":
      return { left, comparison, right: null };
    case "contains":
    case "doesNotContain":
      return containingRowOf(comparison, left, right);
    case "is":
    case "isNot":
    case "isGreaterThan":
    case "isLessThan":
      return comparingRowOf(comparison, left, right);
  }
}

function containingRowOf(
  comparison: ContainingRow["comparison"],
  left: string,
  right: string | undefined,
): ContainingRow | null {
  const value = right === undefined ? undefined : literalOf(right);

  if (value === undefined) {
    return null;
  }

  return { left, comparison, right: { kind: "value", value } };
}

function comparingRowOf(
  comparison: ComparingRow["comparison"],
  left: string,
  right: string | undefined,
): ComparingRow | null {
  const other = right === undefined ? null : operandOf(right);

  if (other === null) {
    return null;
  }

  return { left, comparison, right: other };
}

function operandOf(text: string): Operand | null {
  const isPath = isPathOf(text);
  const value = literalOf(text);
  const time = timeOf(text);

  if (isPath) {
    return { kind: "data", path: text };
  }

  if (value !== undefined) {
    return { kind: "value", value };
  }

  return time === null ? null : { kind: "time", time };
}

function literalOf(text: string): Literal | undefined {
  const isLiteral = isLiteralOf(text);

  if (!isLiteral) {
    return undefined;
  }

  const value: unknown = JSON.parse(text);
  return isLiteralValue(value) ? value : undefined;
}

function isLiteralValue(value: unknown): value is Literal {
  const kind = typeof value;

  return (
    value === null ||
    kind === "string" ||
    kind === "number" ||
    kind === "boolean"
  );
}

function timeOf(text: string): TimeName | null {
  const times = Object.entries(timeExpressions);
  const found = times.find(([, written]) => text === `(${written})`);
  const name = found?.[0];

  return isTimeName(name) ? name : null;
}

function isTimeName(name: string | undefined): name is TimeName {
  return name !== undefined && Object.hasOwn(timeExpressions, name);
}

function wholeOf(source: string): RegExp {
  return new RegExp(`^${source}$`);
}
