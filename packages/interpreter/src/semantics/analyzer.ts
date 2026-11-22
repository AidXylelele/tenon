import type { AnalysisOptions, JsonValue } from "../api/index.js";
import {
  type ExpressionLanguage,
  isJsonObject,
  type SchemaCompiler,
} from "../runtime/index.js";
import {
  elaborate,
  type Finding,
  type GrammarCheck,
  readSource,
  readValue,
  type SchemaAt,
  type SourceDocument,
} from "../syntax/index.js";
import { type CheckSubject, checks } from "./checks/index.js";
import {
  filterDiagnosticsOf,
  filterDocumentOf,
  filterProfile,
} from "./filter-document.js";
import type { Analysis, SemanticModel } from "./model.js";
import {
  diagnosticOf,
  diagnosticsOf,
  placedAtCallSites,
} from "./notification/index.js";
import { resolve } from "./resolve/index.js";
import { symbolsOf } from "./symbols/index.js";

const filterOptions: AnalysisOptions = Object.freeze({
  profile: filterProfile,
  imports: Object.freeze({}),
});

const correlatedFilter: Finding<"correlatedFilter"> = {
  name: "correlatedFilter",
  code: "schema",
  pointer: "/correlate",
  subject: null,
  details: [],
  import: null,
};

export class Analyzer {
  readonly #expressions: ExpressionLanguage;
  readonly #grammar: GrammarCheck;
  readonly #schemas: SchemaCompiler;

  constructor(
    expressions: ExpressionLanguage,
    grammar: GrammarCheck,
    schemas: SchemaCompiler,
  ) {
    this.#expressions = expressions;
    this.#grammar = grammar;
    this.#schemas = schemas;
  }

  analyze(source: string | JsonValue, options: AnalysisOptions): Analysis {
    const reading = readSource(source);

    switch (reading.kind) {
      case "unreadable": {
        const diagnostic = diagnosticOf(
          reading.finding,
          reading.range,
          "document",
        );
        return { kind: "refused", diagnostics: [diagnostic], source: null };
      }
      case "read":
        return this.#checkedOf(reading.source, options);
    }
  }

  schemasAt(document: JsonValue, pointer: string): readonly SchemaAt[] {
    return this.#grammar.schemasAt(document, pointer);
  }

  analyzeFilter(filter: JsonValue): Analysis {
    const reading = readValue(filter);

    switch (reading.kind) {
      case "unreadable": {
        const diagnostic = diagnosticOf(
          reading.finding,
          reading.range,
          "filter",
        );
        return { kind: "refused", diagnostics: [diagnostic], source: null };
      }
      case "read":
        return this.#checkedFilterOf(reading.source);
    }
  }

  #checkedFilterOf(read: SourceDocument): Analysis {
    const filter = read.document;
    const findings = this.#grammar.filterFindingsOf(filter);

    if (findings.length > 0) {
      const diagnostics = diagnosticsOf(findings, read, "filter");
      return { kind: "refused", diagnostics, source: null };
    }

    const correlates = isJsonObject(filter) && "correlate" in filter;

    if (correlates) {
      const diagnostic = diagnosticOf(correlatedFilter, null, "filter");
      return { kind: "refused", diagnostics: [diagnostic], source: null };
    }

    return this.#filterAnalysisOf(filter);
  }

  #filterAnalysisOf(filter: JsonValue): Analysis {
    const document = filterDocumentOf(filter);
    const source: SourceDocument = { document, positions: null };
    const analysis = this.#checkedOf(source, filterOptions);
    const diagnostics = filterDiagnosticsOf(analysis.diagnostics);

    switch (analysis.kind) {
      case "refused":
        return { kind: "refused", diagnostics, source: null };
      case "analyzed":
        return { kind: "analyzed", model: analysis.model, diagnostics };
    }
  }

  #checkedOf(source: SourceDocument, options: AnalysisOptions): Analysis {
    const findings = this.#grammar.findingsOf(source.document);

    if (findings.length > 0) {
      const diagnostics = diagnosticsOf(findings, source, "document");
      return { kind: "refused", diagnostics, source };
    }

    return this.#analyzedOf(source, options);
  }

  #analyzedOf(source: SourceDocument, options: AnalysisOptions): Analysis {
    const workflow = elaborate(source.document);
    const { symbols, occurrences, findings } = symbolsOf(
      workflow,
      options.imports,
      this.#grammar,
    );
    const resolutions = resolve(occurrences, symbols, this.#expressions);
    const model: SemanticModel = {
      workflow,
      symbols,
      resolutions,
      occurrences,
      source,
      imports: options.imports,
    };
    const checked = this.#findingsOf(model, options);
    const found = [...findings, ...checked];
    const placed = placedAtCallSites(found, symbols.components.functions);

    const diagnostics = diagnosticsOf(placed, source, "document");
    return { kind: "analyzed", model, diagnostics };
  }

  #findingsOf(
    model: SemanticModel,
    options: AnalysisOptions,
  ): readonly Finding[] {
    const subject: CheckSubject = {
      workflow: model.workflow,
      symbols: model.symbols,
      occurrences: model.occurrences,
      resolutions: model.resolutions,
      profile: options.profile,
      expressions: this.#expressions,
      schemas: this.#schemas,
    };

    return checks.flatMap((check) => check(subject));
  }
}
