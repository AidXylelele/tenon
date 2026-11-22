import { tokensOf } from "../../runtime/index.js";
import { declaredNamesOf } from "./schemas-at.js";
import type { Branch, SchemaBreach, Violation } from "./types.js";

interface Resolution {
  readonly choice: SchemaBreach;
  readonly formed: readonly Branch[];
}

const valueKeywords = new Set([
  "pattern",
  "format",
  "minLength",
  "minimum",
  "maximum",
]);

const choiceKeywords = new Set(["oneOf", "anyOf"]);

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
  const isResolved = resolutions.every(({ formed }) => formed.length > 0);

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

  return { choice, formed };
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
  const isUnknown = violation.keyword === unknownMember;
  const isAtChoice = violation.instance === resolution.choice.instance;
  const isOfChoice = isUnknown && isAtChoice;

  if (!isOfChoice) {
    return false;
  }

  const member = tokensOf(violation.pointer).at(-1) ?? "";
  const declared = resolution.formed.flatMap(({ schema }) =>
    declaredNamesOf(schema),
  );

  return declared.includes(member);
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
  const isSchema = violation.kind === "schema";
  const isChoosing = choiceKeywords.has(violation.keyword);

  return isSchema && isChoosing;
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
