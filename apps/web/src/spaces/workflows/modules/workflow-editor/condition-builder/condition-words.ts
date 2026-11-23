import type {
  Condition,
  ConditionRow,
  DataAtResult,
  Join,
  Literal,
  WrittenMember,
} from "language-server/protocol";
import { choiceOfExpression, type DataChoice } from "../data-picker";
import { comparisonWordsOf, timeWordsOf } from "./condition-rows";

const SEPARATOR = " › ";

const OWNER_END = SEPARATOR.trimEnd();

const UNREACHED = "data this step cannot reach";

const JOIN_WORDS: Readonly<Record<Join, string>> = {
  all: " and ",
  any: " or ",
};

export function dataChoiceOf(
  path: string,
  data: DataAtResult,
): DataChoice | null {
  const offered = choiceOfExpression(path, data);
  const written = data.written.find((member) => member.expression === path);

  if (offered !== null) return offered;

  if (written === undefined) return null;

  return writtenChoiceOf(written);
}

export function conditionWordsOf(
  condition: Condition,
  data: DataAtResult,
): string | null {
  const rows = condition.rows.map((row) => rowWordsOf(row, data));
  const joint = JOIN_WORDS[condition.join];

  if (rows.length === 0) return null;

  return rows.join(joint);
}

function writtenChoiceOf(member: WrittenMember): DataChoice {
  const owners = member.label.slice(0, -1);
  const label = member.label.join(SEPARATOR);
  const owner =
    owners.length === 0 ? "" : `${owners.join(SEPARATOR)}${OWNER_END}`;

  return {
    id: member.expression,
    label,
    owner,
    name: member.name,
    value: member.value,
    expression: member.expression,
    export: null,
    kind: "data",
    shape: "",
    isPath: true,
  };
}

function rowWordsOf(row: ConditionRow, data: DataAtResult): string {
  const left = dataWordsOf(row.left, data);
  const comparison = comparisonWordsOf(row.comparison);
  const right = rightWordsOf(row, data);
  const words = [left, comparison, right].filter((part) => part !== "");

  return words.join(" ");
}

function rightWordsOf(row: ConditionRow, data: DataAtResult): string {
  const right = row.right;

  if (right === null) return "";

  switch (right.kind) {
    case "value":
      return literalWordsOf(right.value);
    case "time":
      return timeWordsOf(right.time).toLowerCase();
    case "data":
      return dataWordsOf(right.path, data);
  }
}

function dataWordsOf(path: string, data: DataAtResult): string {
  const choice = dataChoiceOf(path, data);

  return choice?.label ?? UNREACHED;
}

function literalWordsOf(value: Literal): string {
  if (typeof value === "string") return `“${value}”`;

  return JSON.stringify(value);
}
