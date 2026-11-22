import type { Range } from "interpreter/front-end";
import { addressSettingOf, secretDeclarationOf } from "../edits/index.js";
import { type Problem, problemsOf, type Snapshot } from "../snapshot/index.js";
import { comparedPositions } from "../text/index.js";
import type { Fix } from "./interfaces.js";

export function fixesAt(snapshot: Snapshot, range: Range): readonly Fix[] {
  const problems = problemsOf(snapshot);
  const here = problems.filter((problem) => overlaps(problem.range, range));
  const undeclared = here.filter(
    (problem) => problem.code === "undeclared-secret",
  );
  const distinct = undeclared.filter(
    (diagnostic, index) =>
      undeclared.findIndex((other) => other.subject === diagnostic.subject) ===
      index,
  );
  const secretFixes = distinct.flatMap((diagnostic) =>
    secretFixesOf(snapshot, diagnostic),
  );
  const addressFixes = here.flatMap((problem) =>
    addressFixesOf(snapshot, problem),
  );

  return [...secretFixes, ...addressFixes];
}

function addressFixesOf(snapshot: Snapshot, problem: Problem): readonly Fix[] {
  const draft = snapshot.draft;
  const isAddress = problem.code === "draft-address";

  if (draft === null || !isAddress) {
    return [];
  }

  const editing = addressSettingOf(snapshot, draft);

  if (editing.kind === "refused") {
    return [];
  }

  const title = `Use ${draft.namespace}/${draft.name}`;
  return [{ title, diagnostic: problem, changes: editing.changes }];
}

function secretFixesOf(
  snapshot: Snapshot,
  diagnostic: Problem,
): readonly Fix[] {
  const name = diagnostic.subject;

  if (name === null) {
    return [];
  }

  const editing = secretDeclarationOf(snapshot, name);

  if (editing.kind === "refused") {
    return [];
  }

  const title = `Declare the secret '${name}'`;
  return [{ title, diagnostic, changes: editing.changes }];
}

function overlaps(written: Range | null, asked: Range): boolean {
  if (written === null) {
    return false;
  }

  const startsBefore = comparedPositions(written.start, asked.end) <= 0;
  const endsAfter = comparedPositions(asked.start, written.end) <= 0;

  return startsBefore && endsAfter;
}
