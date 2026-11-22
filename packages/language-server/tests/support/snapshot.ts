import type { Imports, SemanticModel } from "interpreter/front-end";
import type { Snapshot } from "../../src/ide/snapshot/index.js";
import { analyzer, profile } from "./analyzer.js";

const created = await analyzer;

export function snapshotOf(text: string, imports: Imports = {}): Snapshot {
  const options = { profile, imports };
  const analysis = created.analyze(text, options);

  return { version: 1, text, analysis, basis: null, draft: null };
}

export function snapshotAfter(basisText: string, text: string): Snapshot {
  const basis = snapshotOf(basisText).analysis;

  if (basis.kind !== "analyzed") {
    throw new Error("The basis does not analyse.");
  }

  const options = { profile, imports: {} };
  const analysis = created.analyze(text, options);

  return {
    version: 2,
    text,
    analysis,
    basis: { version: 1, model: basis.model },
    draft: null,
  };
}

export function modelOf(text: string): SemanticModel {
  const analysis = snapshotOf(text).analysis;

  if (analysis.kind !== "analyzed") {
    throw new Error("The text does not analyse.");
  }

  return analysis.model;
}
