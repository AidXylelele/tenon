import type { SchemaViolation } from "../../runtime/index.js";
import type { Finding } from "../findings.js";
import type { RuleBreach, SchemaBreach, Violation } from "./types.js";

export function schemaBreachOf(violation: SchemaViolation): SchemaBreach {
  return {
    kind: "schema",
    pointer: violation.pointer,
    instance: violation.instance,
    keyword: violation.keyword,
    problem: violation.message,
    value: violation.value,
    pattern: violation.pattern,
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
  return {
    ...violation,
    pointer: `${pointer}${violation.pointer}`,
    instance: `${pointer}${violation.instance}`,
  };
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
