import type {
  Analysis,
  SemanticModel,
  SourceDocument,
} from "interpreter/front-end";
import type { Snapshot } from "./interfaces.js";

export function sourceOf(analysis: Analysis): SourceDocument | null {
  switch (analysis.kind) {
    case "analyzed":
      return analysis.model.source;
    case "refused":
      return analysis.source;
  }
}

export function modelOf(snapshot: Snapshot): SemanticModel | null {
  const analysis = snapshot.analysis;

  switch (analysis.kind) {
    case "analyzed":
      return analysis.model;
    case "refused":
      return snapshot.basis?.model ?? null;
  }
}
