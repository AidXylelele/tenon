import type {
  AnalysisOptions,
  Diagnostic,
  EventFilter,
  JsonValue,
  Program,
} from "./api/index.js";
import type { Analysis } from "./semantics/index.js";

export interface Interpreter {
  compile(source: string | JsonValue, options: AnalysisOptions): Compilation;

  filter(filter: JsonValue): FilterCompilation;
}

interface CompiledDocument {
  readonly kind: "compiled";
  readonly program: Program;
  readonly analysis: Analysis;
}

interface RefusedDocument {
  readonly kind: "refused";
  readonly diagnostics: readonly Diagnostic[];
  readonly analysis: Analysis;
}

export type Compilation = CompiledDocument | RefusedDocument;

interface CompiledFilter {
  readonly kind: "compiled";
  readonly filter: EventFilter;
}

interface RefusedFilter {
  readonly kind: "refused";
  readonly diagnostics: readonly Diagnostic[];
}

export type FilterCompilation = CompiledFilter | RefusedFilter;
