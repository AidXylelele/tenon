import { capitalizedOf, pointerNameOf } from "../../runtime/index.js";
import type { SchemaBreach, Violation } from "./types.js";
import workflowSchema from "./workflow-schema.json" with { type: "json" };

const header = workflowSchema.properties.document.properties;

const versionPattern = header.version.pattern;

const namePattern = header.name.pattern;

const durationPattern = workflowSchema.$defs.duration.oneOf[2]?.pattern;

const unknownMembers = new Set([
  "unevaluatedProperties",
  "additionalProperties",
]);

type Around = ReadonlyMap<string, readonly SchemaBreach[]>;

export function wordedViolationsOf(
  chosen: readonly Violation[],
  violations: readonly Violation[],
): readonly Violation[] {
  const breaches = violations.filter(
    (violation): violation is SchemaBreach => violation.kind === "schema",
  );
  const around = Map.groupBy(breaches, ({ instance }) => instance);

  return chosen.map((violation) => wordedViolationOf(violation, around));
}

function wordedViolationOf(violation: Violation, around: Around): Violation {
  switch (violation.kind) {
    case "schema": {
      const problem = problemOf(violation, around);
      return { ...violation, problem };
    }
    case "rule":
      return violation;
  }
}

function problemOf(breach: SchemaBreach, nearby: Around): string {
  const around = nearby.get(breach.instance) ?? [];
  const isDuration = around.some(({ pattern }) => pattern === durationPattern);
  const value = breach.value;

  if (isDuration && typeof value === "string") {
    return `${value} is not a duration.`;
  }

  const unknown = around.find(({ keyword }) => unknownMembers.has(keyword));
  const isMistyped = breach.keyword === "type" && unknown !== undefined;

  if (isMistyped) {
    return unknown.problem;
  }

  if (breach.keyword === "pattern") {
    return patternProblemOf(breach);
  }

  return breach.problem;
}

function patternProblemOf(breach: SchemaBreach): string {
  const named = pointerNameOf(breach.pointer);
  const name = capitalizedOf(named);

  switch (breach.pattern) {
    case versionPattern:
      return `${name} must look like 1.0.0.`;
    case namePattern:
      return `${name} must be letters, digits and hyphens, with no hyphen at either end.`;
    default:
      return `${name} is not in the form the standard requires.`;
  }
}
