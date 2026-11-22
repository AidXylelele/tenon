import { problemsOf, type Snapshot } from "../snapshot/index.js";
import type { DocumentReading } from "./interfaces.js";

export function documentOf(snapshot: Snapshot): DocumentReading {
  const analysis = snapshot.analysis;
  const problems = problemsOf(snapshot);
  const isClean = analysis.kind === "analyzed" && problems.length === 0;

  if (!isClean) {
    return { kind: "refused", diagnostics: problems };
  }

  return { kind: "document", document: analysis.model.source.document };
}
