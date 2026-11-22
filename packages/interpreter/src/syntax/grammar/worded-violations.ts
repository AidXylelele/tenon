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

export function wordedViolationOf(
  violation: Violation,
  violations: readonly Violation[],
): Violation {
  switch (violation.kind) {
    case "schema": {
      const problem = problemOf(violation, violations);
      return { ...violation, problem };
    }
    case "rule":
      return violation;
  }
}

function problemOf(
  breach: SchemaBreach,
  violations: readonly Violation[],
): string {
  const around = violations.filter(
    (violation): violation is SchemaBreach =>
      violation.kind === "schema" && violation.instance === breach.instance,
  );
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
