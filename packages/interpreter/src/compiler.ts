import type { AnalysisOptions, JsonValue } from "./api/index.js";
import { type Translator, eventFilterOf } from "./core/index.js";
import type {
  Compilation,
  FilterCompilation,
  Interpreter,
} from "./interpreter.js";
import { type MachineServices, Runner } from "./machine/index.js";
import type { Analysis, Analyzer, SemanticModel } from "./semantics/index.js";

export class Compiler implements Interpreter {
  readonly #analyzer: Analyzer;
  readonly #translator: Translator;
  readonly #services: MachineServices;

  constructor(
    analyzer: Analyzer,
    translator: Translator,
    services: MachineServices,
  ) {
    this.#analyzer = analyzer;
    this.#translator = translator;
    this.#services = services;
  }

  compile(source: string | JsonValue, options: AnalysisOptions): Compilation {
    const analysis = this.#analyzer.analyze(source, options);
    const model = this.#modelOf(analysis);

    if (model === null) {
      return { kind: "refused", diagnostics: analysis.diagnostics, analysis };
    }

    const translated = this.#translator.translate(model);
    const program = new Runner(translated, this.#services);

    return { kind: "compiled", program, analysis };
  }

  filter(filter: JsonValue): FilterCompilation {
    const analysis = this.#analyzer.analyzeFilter(filter);
    const model = this.#modelOf(analysis);

    if (model === null) {
      return { kind: "refused", diagnostics: analysis.diagnostics };
    }

    const translated = this.#translator.translate(model);
    const eventFilter = eventFilterOf(translated, this.#services.expressions);

    return { kind: "compiled", filter: eventFilter };
  }

  #modelOf(analysis: Analysis): SemanticModel | null {
    const isTranslatable =
      analysis.kind === "analyzed" && analysis.diagnostics.length === 0;

    return isTranslatable ? analysis.model : null;
  }
}
