import type { Located } from "./types.js";

const combinators = new Set(["oneOf", "anyOf", "allOf", "not", "if"]);

export function deepestViolationsOf<Violation extends Located>(
  violations: readonly Violation[],
): readonly Violation[] {
  const explaining = meaningfulViolationsOf(violations);
  const deepest = innermostViolationsOf(explaining);
  const groups = Map.groupBy(deepest, ({ pointer }) => pointer);

  const atEachPointer = [...groups.values()];
  return atEachPointer.flatMap(chosenViolationOf);
}

function meaningfulViolationsOf<Violation extends Located>(
  violations: readonly Violation[],
): readonly Violation[] {
  const failed = violations.flatMap(failedInstancesOf);
  const failedInstances = new Set(failed);

  return violations.filter(
    (violation) =>
      violation.keyword !== "unevaluatedProperties" ||
      !failedInstances.has(violation.instance),
  );
}

function failedInstancesOf(violation: Located): readonly string[] {
  const combines = isCombinator(violation);

  if (!combines) {
    return [];
  }

  return [violation.instance];
}

function isCombinator(violation: Located): boolean {
  return combinators.has(violation.keyword);
}

function innermostViolationsOf<Violation extends Located>(
  violations: readonly Violation[],
): readonly Violation[] {
  const ancestors = violations.flatMap(({ pointer }) => ancestorsOf(pointer));
  const ancestorPointers = new Set(ancestors);

  return violations.filter(({ pointer }) => !ancestorPointers.has(pointer));
}

function ancestorsOf(pointer: string): readonly string[] {
  const tokens = pointer.split("/");
  const prefixes = tokens.map((_, end) => tokens.slice(0, end).join("/"));

  return prefixes.slice(1);
}

function chosenViolationOf<Violation extends Located>(
  violations: readonly Violation[],
): readonly Violation[] {
  const specific = violations.filter((violation) => !isCombinator(violation));
  const preferred = specific.length > 0 ? specific : violations.toReversed();

  return preferred.slice(0, 1);
}
