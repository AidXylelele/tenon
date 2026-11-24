import type { Diagnostic, Imports } from "../api/index.js";
import type { SourceDocument, Workflow } from "../syntax/index.js";
import type { Occurrence } from "./occurrences/index.js";
import type { Resolutions } from "./resolve/index.js";
import type { Symbols } from "./symbols/index.js";

export interface SemanticModel {
  readonly workflow: Workflow;
  readonly symbols: Symbols;
  readonly resolutions: Resolutions;
  readonly occurrences: readonly Occurrence[];
  readonly source: SourceDocument;
  readonly imports: Imports;
}

interface Refused {
  readonly kind: "refused";
  readonly diagnostics: readonly Diagnostic[];
  readonly source: SourceDocument | null;
}

interface Analyzed {
  readonly kind: "analyzed";
  readonly model: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
}

export type Analysis = Refused | Analyzed;
