import { isWarning, problemsOf, type Snapshot } from "../snapshot/index.js";
import type { DocumentReading } from "./interfaces.js";

export function documentOf(snapshot: Snapshot): DocumentReading {
  const analysis = snapshot.analysis;
  const problems = problemsOf(snapshot);
  const errors = problems.filter((problem) => !isWarning(problem));
  const isClean = analysis.kind === "analyzed" && errors.length === 0;

  if (!isClean) {
    return { kind: "refused", diagnostics: errors };
  }

  return { kind: "document", document: analysis.model.source.document };
}
