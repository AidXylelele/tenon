import type { AnalysisOptions, EventFilter, JsonValue } from "./api/index.js";
import { type Translator, eventFilterOf } from "./core/index.js";
import type {
  Compilation,
  FilterCompilation,
  Interpreter,
} from "./interpreter.js";
import { type MachineServices, Runner } from "./machine/index.js";
import type { Analysis, Analyzer, SemanticModel } from "./semantics/index.js";
import type { CompilePhases, Telemetry } from "./telemetry/index.js";

export class Compiler implements Interpreter {
  readonly #analyzer: Analyzer;
  readonly #translator: Translator;
  readonly #services: MachineServices;
  readonly #telemetry: Telemetry;

  constructor(
    analyzer: Analyzer,
    translator: Translator,
    services: MachineServices,
    telemetry: Telemetry,
  ) {
    this.#analyzer = analyzer;
    this.#translator = translator;
    this.#services = services;
    this.#telemetry = telemetry;
  }

  compile(source: string | JsonValue, options: AnalysisOptions): Compilation {
    return this.#telemetry.compile("workflow", (phases) =>
      this.#compiledIn(phases, source, options),
    );
  }

  filter(filter: JsonValue): FilterCompilation {
    return this.#telemetry.compile("filter", (phases) =>
      this.#filteredIn(phases, filter),
    );
  }

  #compiledIn(
    phases: CompilePhases,
    source: string | JsonValue,
    options: AnalysisOptions,
  ): Compilation {
    const analysis = phases.analyze(() =>
      this.#analyzer.analyze(source, options),
    );
    const model = this.#modelOf(analysis);

    if (model === null) {
      return { kind: "refused", diagnostics: analysis.diagnostics, analysis };
    }

    const program = phases.translate(() => this.#runnerOf(model));

    return { kind: "compiled", program, analysis };
  }

  #filteredIn(phases: CompilePhases, filter: JsonValue): FilterCompilation {
    const analysis = phases.analyze(() => this.#analyzer.analyzeFilter(filter));
    const model = this.#modelOf(analysis);

    if (model === null) {
      return { kind: "refused", diagnostics: analysis.diagnostics };
    }

    const eventFilter = phases.translate(() => this.#eventFilterOf(model));

    return { kind: "compiled", filter: eventFilter };
  }

  #runnerOf(model: SemanticModel): Runner {
    const translated = this.#translator.translate(model);

    return new Runner(translated, this.#services, this.#telemetry);
  }

  #eventFilterOf(model: SemanticModel): EventFilter {
    const translated = this.#translator.translate(model);

    return eventFilterOf(translated, this.#services.expressions);
  }

  #modelOf(analysis: Analysis): SemanticModel | null {
    const isTranslatable =
      analysis.kind === "analyzed" && analysis.diagnostics.length === 0;

    return isTranslatable ? analysis.model : null;
  }
}
