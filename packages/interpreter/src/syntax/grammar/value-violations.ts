import type { JsonValue } from "../../api/index.js";
import { isJsonObject, tokensOf } from "../../runtime/index.js";
import { declaredNamesOf } from "./schemas-at.js";
import type { Branch, SchemaBreach, Violation } from "./types.js";

interface Resolution {
  readonly choice: SchemaBreach;
  readonly holder: Branch | null;
}

const valueKeywords = new Set([
  "pattern",
  "format",
  "minLength",
  "minimum",
  "maximum",
]);

const summaryKeywords = new Set(["if"]);

const unknownMember = "unevaluatedProperties";

export function isStructureIntact(violations: readonly Violation[]): boolean {
  const choices = violations.filter(isChoice);
  const nested = choices.flatMap(branchViolationsOf);
  const nestedKeys = new Set(nested.map(keyOf));
  const outermost = choices.filter((choice) => isOutermost(choice, nestedKeys));
  const isAmbiguous = outermost.some((choice) => choice.ambiguous);

  if (isAmbiguous) {
    return false;
  }

  const resolutions = outermost.map(resolutionOf);
  const isResolved = resolutions.every(({ holder }) => holder !== null);

  if (!isResolved) {
    return false;
  }

  const explained = resolutions.flatMap((resolution) =>
    explainedOf(resolution, violations),
  );
  const remaining = remainderOf(violations, explained);

  return remaining.every(isOfValueOrSummary);
}

function isOutermost(
  choice: SchemaBreach,
  nestedKeys: ReadonlySet<string>,
): boolean {
  const key = keyOf(choice);
  return !nestedKeys.has(key);
}

function resolutionOf(choice: SchemaBreach): Resolution {
  const formed = choice.branches.filter((branch) =>
    isStructureIntact(branch.violations),
  );
  const written = writtenMembersOf(choice.value);
  const offered = written.filter((member) => isOfferedBy(member, formed));
  const holder = formed.find((branch) => declaresAll(branch, offered)) ?? null;

  return { choice, holder };
}

function writtenMembersOf(value: JsonValue): readonly string[] {
  const isObject = isJsonObject(value);

  if (!isObject) {
    return [];
  }

  return Object.keys(value);
}

function isOfferedBy(member: string, formed: readonly Branch[]): boolean {
  return formed.some((branch) => isDeclaredBy(member, branch));
}

function declaresAll(branch: Branch, members: readonly string[]): boolean {
  return members.every((member) => isDeclaredBy(member, branch));
}

function isDeclaredBy(member: string | null, branch: Branch): boolean {
  if (member === null) {
    return false;
  }

  const declared = declaredNamesOf(branch.schema);
  return declared.includes(member);
}

function explainedOf(
  resolution: Resolution,
  violations: readonly Violation[],
): readonly Violation[] {
  const { choice } = resolution;
  const inBranches = branchViolationsOf(choice);
  const dropped = violations.filter((violation) =>
    isDroppedMember(violation, resolution),
  );

  return [choice, ...inBranches, ...dropped];
}

function isDroppedMember(
  violation: Violation,
  resolution: Resolution,
): boolean {
  const { choice, holder } = resolution;
  const isUnknown = violation.keyword === unknownMember;
  const isAtChoice = violation.instance === choice.instance;
  const isOfChoice = isUnknown && isAtChoice;

  if (!isOfChoice) {
    return false;
  }

  if (holder === null) {
    return false;
  }

  const member = memberOf(violation);
  return isDeclaredBy(member, holder);
}

function memberOf(violation: Violation): string | null {
  const tokens = tokensOf(violation.pointer);
  return tokens.at(-1) ?? null;
}

function remainderOf(
  violations: readonly Violation[],
  explained: readonly Violation[],
): readonly Violation[] {
  const counts = Map.groupBy(explained, keyOf);
  const groups = Map.groupBy(violations, keyOf);
  const entries = [...groups.entries()];

  return entries.flatMap(([key, group]) => {
    const excused = counts.get(key)?.length ?? 0;
    return group.slice(excused);
  });
}

function branchViolationsOf(choice: SchemaBreach): readonly SchemaBreach[] {
  return choice.branches.flatMap(({ violations }) => violations);
}

function isChoice(violation: Violation): violation is SchemaBreach {
  switch (violation.kind) {
    case "schema":
      return violation.branches.length > 0;
    case "rule":
      return false;
  }
}

function isOfValueOrSummary(violation: Violation): boolean {
  const isValue = valueKeywords.has(violation.keyword);
  const isSummary = summaryKeywords.has(violation.keyword);

  return isValue || isSummary;
}

function keyOf(violation: Violation): string {
  switch (violation.kind) {
    case "schema":
      return [
        violation.keyword,
        violation.instance,
        violation.pointer,
        violation.location,
        violation.problem,
      ].join("\n");
    case "rule":
      return [violation.keyword, violation.pointer, violation.rule].join("\n");
  }
}
