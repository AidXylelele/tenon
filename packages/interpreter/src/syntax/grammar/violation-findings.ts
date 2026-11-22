import type { SchemaBranch, SchemaViolation } from "../../runtime/index.js";
import type { Finding } from "../findings.js";
import type { Branch, RuleBreach, SchemaBreach, Violation } from "./types.js";

export function schemaBreachOf(violation: SchemaViolation): SchemaBreach {
  const branches = violation.branches.map(branchOf);

  return {
    kind: "schema",
    pointer: violation.pointer,
    instance: violation.instance,
    keyword: violation.keyword,
    problem: violation.message,
    value: violation.value,
    pattern: violation.pattern,
    location: violation.location,
    ambiguous: violation.ambiguous,
    branches,
  };
}

export function violationFindingOf(violation: Violation): Finding {
  switch (violation.kind) {
    case "schema":
      return schemaFindingOf(violation);
    case "rule":
      return ruleFindingOf(violation);
  }
}

export function prefixedViolationOf(
  violation: Violation,
  pointer: string,
): Violation {
  switch (violation.kind) {
    case "schema":
      return prefixedBreachOf(violation, pointer);
    case "rule":
      return {
        ...violation,
        pointer: `${pointer}${violation.pointer}`,
        instance: `${pointer}${violation.instance}`,
      };
  }
}

function branchOf(branch: SchemaBranch): Branch {
  const violations = branch.violations.map(schemaBreachOf);
  return { schema: branch.schema, violations };
}

function prefixedBreachOf(breach: SchemaBreach, pointer: string): SchemaBreach {
  const branches = breach.branches.map((branch) =>
    prefixedBranchOf(branch, pointer),
  );

  return {
    ...breach,
    pointer: `${pointer}${breach.pointer}`,
    instance: `${pointer}${breach.instance}`,
    branches,
  };
}

function prefixedBranchOf(branch: Branch, pointer: string): Branch {
  const violations = branch.violations.map((violation) =>
    prefixedBreachOf(violation, pointer),
  );

  return { schema: branch.schema, violations };
}

function schemaFindingOf(breach: SchemaBreach): Finding<"schema"> {
  return {
    name: "schema",
    code: "schema",
    pointer: breach.pointer,
    subject: null,
    details: [breach.problem],
    import: null,
  };
}

function ruleFindingOf(breach: RuleBreach): Finding {
  return {
    name: breach.rule,
    code: "schema",
    pointer: breach.pointer,
    subject: null,
    details: [],
    import: null,
  };
}
