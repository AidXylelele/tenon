import type { JsonValue } from "interpreter/front-end";
import { type ConditionRow, conditionOf } from "../conditions/index.js";
import { runtimeExpressionOf } from "../jq-text/index.js";
import { valueAt } from "../pointers/index.js";
import { type TemplatePart, templateOf } from "../templates/index.js";
import type { DataEntry, DataMember, WrittenMember } from "./interfaces.js";

const flowing = ".";

const workflowInputWords = "The workflow's input";

const segments = /\.([A-Za-z_][A-Za-z0-9_]*)|\.?\[("(?:[^"\\]|\\.)*")\]/gy;

export function writtenMembersOf(
  document: JsonValue,
  field: string,
  entries: readonly DataEntry[],
): readonly WrittenMember[] {
  const written = valueAt(document, field);

  if (typeof written !== "string") {
    return [];
  }

  const paths = pathsIn(written);
  const unique = [...new Set(paths)];

  return unique.flatMap((path) => writtenMemberOf(path, entries));
}

function pathsIn(text: string): readonly string[] {
  const condition = conditionOf(text);
  const template = templateOf(text);
  const rows = condition.kind === "condition" ? condition.condition.rows : [];
  const parts = template.kind === "template" ? template.parts : [];
  const inRows = rows.flatMap(rowPathsOf);
  const inParts = parts.flatMap(partPathsOf);

  return [...inRows, ...inParts];
}

function rowPathsOf(row: ConditionRow): readonly string[] {
  const right = row.right;

  if (right?.kind !== "data") {
    return [row.left];
  }

  return [row.left, right.path];
}

function partPathsOf(part: TemplatePart): readonly string[] {
  if (part.kind === "text") {
    return [];
  }

  return [part.expression];
}

function writtenMemberOf(
  path: string,
  entries: readonly DataEntry[],
): readonly WrittenMember[] {
  const paths = entries.filter((entry) => entry.isPath);
  const owner = paths.find((entry) => restOf(path, entry.expression) !== null);

  if (owner === undefined) {
    return [];
  }

  const rest = restOf(path, owner.expression) ?? "";
  const names = namesOf(rest);

  if (names === null) {
    return [];
  }

  const root = rootWordsOf(owner);
  const label = [root, ...names];
  const known = memberWithExpression(owner, path);
  const member: WrittenMember = {
    name: label.at(-1) ?? root,
    expression: path,
    value: runtimeExpressionOf(path),
    isPath: true,
    shape: known?.shape ?? "unknown",
    size: known?.size ?? null,
    members: [],
    label,
  };

  return [member];
}

function restOf(path: string, base: string): string | null {
  const isFlowing = base === flowing;
  const isBelowFlowing = isFlowing && path.startsWith(flowing);

  if (path === base) {
    return "";
  }

  if (isBelowFlowing) {
    return path;
  }

  if (isFlowing || !path.startsWith(base)) {
    return null;
  }

  const rest = path.slice(base.length);
  const isMember = rest.startsWith(".") || rest.startsWith("[");

  return isMember ? rest : null;
}

function namesOf(rest: string): readonly string[] | null {
  const matches = [...rest.matchAll(segments)];
  const read = matches.reduce((length, match) => length + match[0].length, 0);

  if (read !== rest.length) {
    return null;
  }

  return matches.map(nameOf);
}

function nameOf(match: RegExpExecArray): string {
  const [, name, key] = match;

  if (name !== undefined) {
    return name;
  }

  const text: unknown = JSON.parse(key ?? '""');
  return String(text);
}

function rootWordsOf(entry: DataEntry): string {
  if (entry.source === "workflowInput") {
    return workflowInputWords;
  }

  return entry.name;
}

function memberWithExpression(
  member: DataMember,
  expression: string,
): DataMember | null {
  if (member.expression === expression) {
    return member;
  }

  const found = member.members.map((each) =>
    memberWithExpression(each, expression),
  );

  return found.find((each) => each !== null) ?? null;
}
