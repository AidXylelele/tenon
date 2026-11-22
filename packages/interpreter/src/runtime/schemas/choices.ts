import { isJsonArray } from "../json/index.js";
import type {
  Choice,
  Expansion,
  Report,
  SchemaBranch,
  SchemaLocation,
  SchemaViolation,
} from "./types.js";

type Expansions = ReadonlyMap<string, readonly Expansion[]>;

const choiceKeywords = new Set(["oneOf", "anyOf"]);

export function choiceOf(
  violation: SchemaViolation,
  parent: SchemaLocation | null,
): Choice | null {
  const isChoice = choiceKeywords.has(violation.keyword);

  if (!isChoice) {
    return null;
  }

  if (parent === null) {
    return null;
  }

  const written = parent.node[violation.keyword] ?? null;
  const alternatives = isJsonArray(written) ? written : [];
  const reference = `${parent.uri}/${violation.keyword}`;
  const key = [reference, violation.instance].join("\n");
  const { value, instance } = violation;

  return { key, reference, alternatives, value, instance };
}

export function distinctChoicesOf(
  reports: readonly Report[],
): readonly Choice[] {
  const choices = reports
    .map(({ choice }) => choice)
    .filter((choice) => choice !== null);
  const byKey = Map.groupBy(choices, ({ key }) => key);
  const groups = [...byKey.values()];

  return groups.flatMap((group) => group.slice(0, 1));
}

export function linkedViolationsOf(
  reports: readonly Report[],
  expansions: Expansions,
): readonly SchemaViolation[] {
  return reports.map((report) => linkedViolationOf(report, expansions));
}

function linkedViolationOf(
  report: Report,
  expansions: Expansions,
): SchemaViolation {
  const { violation, choice } = report;

  if (choice === null) {
    return violation;
  }

  const expanded = expansions.get(choice.key) ?? [];
  const branches = expanded.map((expansion) =>
    linkedBranchOf(expansion, expansions),
  );

  return { ...violation, branches };
}

function linkedBranchOf(
  expansion: Expansion,
  expansions: Expansions,
): SchemaBranch {
  const violations = linkedViolationsOf(expansion.reports, expansions);
  return { schema: expansion.schema, violations };
}
