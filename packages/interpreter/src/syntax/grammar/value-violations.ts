import type { JsonValue } from "../../api/index.js";
import { isJsonObject, lastTokenOf } from "../../runtime/index.js";
import { declaredNamesOf } from "./schemas-at.js";
import type { Branch, SchemaBreach, Violation } from "./types.js";

interface Resolution {
  readonly choice: SchemaBreach;
  readonly holder: ReadonlySet<string> | null;
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
  const isPlain = choices.length === 0;

  if (isPlain) {
    return violations.every(isOfValueOrSummary);
  }

  const outermost = outermostOf(choices);
  const isAmbiguous = outermost.some((choice) => choice.ambiguous);

  if (isAmbiguous) {
    return false;
  }

  const resolutions = outermost.map(resolutionOf);
  const isResolved = resolutions.every(({ holder }) => holder !== null);

  if (!isResolved) {
    return false;
  }

  return isRestOfValues(violations, resolutions);
}

function outermostOf(
  choices: readonly SchemaBreach[],
): readonly SchemaBreach[] {
  const nested = choices.flatMap(nestedChoicesOf);
  const nestedKeys = new Set(nested.map(keyOf));

  return choices.filter((choice) => isOutermost(choice, nestedKeys));
}

function isRestOfValues(
  violations: readonly Violation[],
  resolutions: readonly Resolution[],
): boolean {
  const unknown = violations.filter(isUnknownMember);
  const unknownAt = Map.groupBy(unknown, ({ instance }) => instance);
  const explained = resolutions.flatMap((resolution) =>
    explainedOf(resolution, unknownAt),
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
  const declarations = formed.map(declaredOf);
  const written = writtenMembersOf(choice.value);
  const offered = written.filter((member) => isOfferedBy(member, declarations));
  const holder =
    declarations.find((declared) => declaresAll(declared, offered)) ?? null;

  return { choice, holder };
}

function isOfferedBy(
  member: string,
  declarations: readonly ReadonlySet<string>[],
): boolean {
  return declarations.some((declared) => declared.has(member));
}

function declaredOf(branch: Branch): ReadonlySet<string> {
  const names = declaredNamesOf(branch.schema);
  return new Set(names);
}

function writtenMembersOf(value: JsonValue): readonly string[] {
  const isObject = isJsonObject(value);

  if (!isObject) {
    return [];
  }

  return Object.keys(value);
}

function declaresAll(
  declared: ReadonlySet<string>,
  members: readonly string[],
): boolean {
  return members.every((member) => declared.has(member));
}

function explainedOf(
  resolution: Resolution,
  unknownAt: ReadonlyMap<string, readonly Violation[]>,
): readonly Violation[] {
  const { choice, holder } = resolution;
  const inBranches = branchViolationsOf(choice);
  const atChoice = unknownAt.get(choice.instance) ?? [];
  const dropped = atChoice.filter((violation) =>
    isDroppedMember(violation, holder),
  );

  return [choice, ...inBranches, ...dropped];
}

function isUnknownMember(violation: Violation): boolean {
  return violation.keyword === unknownMember;
}

function isDroppedMember(
  violation: Violation,
  holder: ReadonlySet<string> | null,
): boolean {
  const member = lastTokenOf(violation.pointer);

  if (holder === null) {
    return false;
  }

  if (member === null) {
    return false;
  }

  return holder.has(member);
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

function nestedChoicesOf(choice: SchemaBreach): readonly SchemaBreach[] {
  const inBranches = branchViolationsOf(choice);
  return inBranches.filter(isChoice);
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
    case "schema": {
      const { keyword, instance, pointer, location } = violation;
      return `${keyword}\n${instance}\n${pointer}\n${location ?? ""}`;
    }
    case "rule": {
      const { keyword, pointer, rule } = violation;
      return `${keyword}\n${pointer}\n${rule}`;
    }
  }
}
