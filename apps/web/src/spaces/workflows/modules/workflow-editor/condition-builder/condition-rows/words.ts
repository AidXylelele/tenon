import type { Comparison, Literal } from "language-server/protocol";
import type {
  ComparisonWords,
  SecondValue,
  TimeName,
  Typed,
} from "./interfaces";

export const COMPARISONS: readonly ComparisonWords[] = [
  { comparison: "isNotEmpty", words: "is not empty" },
  { comparison: "isEmpty", words: "is empty" },
  { comparison: "is", words: "is" },
  { comparison: "isNot", words: "is not" },
  { comparison: "contains", words: "contains" },
  { comparison: "doesNotContain", words: "does not contain" },
  { comparison: "isGreaterThan", words: "is greater than" },
  { comparison: "isLessThan", words: "is less than" },
];

const SECOND_VALUES: Readonly<Record<Comparison, SecondValue>> = {
  isNotEmpty: "none",
  isEmpty: "none",
  is: "operand",
  isNot: "operand",
  contains: "value",
  doesNotContain: "value",
  isGreaterThan: "operand",
  isLessThan: "operand",
};

export const TIMES: readonly {
  readonly time: TimeName;
  readonly words: string;
}[] = [
  { time: "now", words: "Now" },
  { time: "today", words: "Today" },
  { time: "yesterday", words: "Yesterday" },
];

const ORDERING: ReadonlySet<Comparison> = new Set([
  "isGreaterThan",
  "isLessThan",
]);

const NUMBER = /^-?\d+(?:\.\d+)?$/;

const QUOTED = /^".*"$/;

const WORDS: ReadonlyMap<string, Literal> = new Map<string, Literal>([
  ["true", true],
  ["false", false],
  ["null", null],
]);

export function comparisonWordsOf(comparison: Comparison): string {
  const found = COMPARISONS.find((each) => each.comparison === comparison);

  return found?.words ?? comparison;
}

export function timeWordsOf(time: TimeName): string {
  const found = TIMES.find((each) => each.time === time);

  return found?.words ?? time;
}

export function secondOf(comparison: Comparison): SecondValue {
  return SECOND_VALUES[comparison];
}

export function literalOf(text: string, comparison: Comparison): Typed {
  const trimmed = text.trim();
  const isNumber = NUMBER.test(trimmed);

  if (trimmed === "") return { kind: "refused", reason: "Enter a value." };

  if (ORDERING.has(comparison) && !isNumber)
    return { kind: "refused", reason: "Enter a number." };

  if (isNumber) return { kind: "literal", value: Number(trimmed) };

  if (WORDS.has(trimmed))
    return { kind: "literal", value: WORDS.get(trimmed) ?? null };

  if (QUOTED.test(trimmed)) return quotedOf(trimmed);

  return { kind: "literal", value: trimmed };
}

function quotedOf(text: string): Typed {
  try {
    const value: unknown = JSON.parse(text);
    const written = typeof value === "string" ? value : text;
    return { kind: "literal", value: written };
  } catch {
    return { kind: "literal", value: text };
  }
}

export function literalText(value: Literal): string {
  if (typeof value !== "string") return JSON.stringify(value);

  const typed = literalOf(value, "is");
  const readsAsWritten = typed.kind === "literal" && typed.value === value;

  return readsAsWritten ? value : JSON.stringify(value);
}
