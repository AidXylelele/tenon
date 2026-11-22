import { Inject, Injectable } from "@nestjs/common";
import type {
  CloudEvent,
  EventFilter,
  Interpreter,
  JsonObject,
  JsonValue,
  Program,
  Step,
} from "interpreter";
import type { Analysis, ast } from "interpreter/front-end";
import { structureOf } from "language-server/structure";
import type {
  CompilationData,
  FilterCheck,
  InputSchema,
  NamedFilter,
  RouteMatch,
  StartedStep,
  VersionStructure,
} from "../../interface-adapters/workflows/interfaces.js";
import type {
  CompileSource,
  ProgramWorkerCall,
  WorkerAnswer,
  WorkerCall,
} from "./interfaces.js";

@Injectable()
export class InterpreterWorker {
  static readonly INTERPRETER = "interpreter";
  private static readonly KEPT = 1_000;

  readonly #programs = new Map<string, Program | null>();
  readonly #filters = new Map<string, EventFilter | null>();

  constructor(
    @Inject(InterpreterWorker.INTERPRETER)
    private readonly interpreter: Interpreter,
  ) {}

  handle(call: WorkerCall): WorkerAnswer<unknown> {
    try {
      return this.#answered(call);
    } catch (error) {
      return this.#faultOf(error);
    }
  }

  #answered(call: WorkerCall): WorkerAnswer<unknown> {
    switch (call.kind) {
      case "compile":
        return { kind: "answered", value: this.#compiled(call.source) };
      case "structure":
        return { kind: "answered", value: this.#structured(call.source) };
      case "filter":
        return { kind: "answered", value: this.#checked(call.filter) };
      case "accepting": {
        const accepting = this.#accepting(call.filters, call.event);
        return { kind: "answered", value: accepting };
      }
      case "start":
      case "correlate":
      case "respond":
      case "suspend":
      case "resume":
      case "cancel":
      case "route":
      case "input":
        return this.#ofProgram(call);
    }
  }

  #ofProgram(call: ProgramWorkerCall): WorkerAnswer<unknown> {
    const thread = call.program;
    const kept = this.#programs.get(thread.versionId);

    if (kept !== undefined) {
      this.#keep(this.#programs, thread.versionId, kept);
      return this.#playedBy(kept, call);
    }

    if (thread.source === null) return { kind: "missing" };

    const compiled = this.#compiledOf(thread.versionId, thread.source);
    return this.#playedBy(compiled, call);
  }

  #playedBy(
    program: Program | null,
    call: ProgramWorkerCall,
  ): WorkerAnswer<unknown> {
    const required = call.program.fingerprint;

    if (required !== null && program?.fingerprint !== required)
      return { kind: "incompatible" };

    if (program === null)
      throw new TypeError(
        `The version ${call.program.versionId} does not compile`,
      );

    return { kind: "answered", value: this.#played(program, call) };
  }

  #played(program: Program, call: ProgramWorkerCall): unknown {
    switch (call.kind) {
      case "start": {
        const step = program.start(call.input, call.context);
        return this.#started(program, step);
      }
      case "correlate": {
        const step = program.correlate(call.context);
        return this.#started(program, step);
      }
      case "respond":
        return program.respond(call.state, call.response, call.context);
      case "suspend":
        return program.suspend(call.state, call.context);
      case "resume":
        return program.resume(call.state, call.context);
      case "cancel":
        return program.cancel(call.state, call.context);
      case "route":
        return this.#routes(program, call.event);
      case "input":
        return program.inputProblemsOf(call.input);
    }
  }

  #started(program: Program, step: Step): StartedStep {
    return { step, fingerprint: program.fingerprint };
  }

  #routes(program: Program, event: CloudEvent): readonly RouteMatch[] {
    const accepting = program.manifest.filters.filter((routing) =>
      routing.accepts(event),
    );
    return accepting.map((routing) => ({
      stream: routing.stream,
      level: routing.level,
      filter: routing.filter,
    }));
  }

  #compiled(source: CompileSource): CompilationData {
    const compilation = this.#compilationOf(source);

    if (compilation.kind === "refused")
      return { kind: "refused", diagnostics: compilation.diagnostics };

    const program = compilation.program;
    const manifest = program.manifest;
    const document = this.#documentOf(compilation.analysis);
    return {
      kind: "compiled",
      manifest: {
        identity: manifest.identity,
        effects: manifest.effects,
        secrets: manifest.secrets,
        schedules: manifest.schedules,
      },
      fingerprint: program.fingerprint,
      document,
    };
  }

  #documentOf(analysis: Analysis): JsonObject {
    const read =
      analysis.kind === "analyzed" ? analysis.model.source : analysis.source;
    return (read?.document ?? {}) as JsonObject;
  }

  #structured(source: CompileSource): VersionStructure | null {
    const analysis = this.#compilationOf(source).analysis;
    const structure = structureOf(analysis);

    if (structure === null || analysis.kind === "refused") return null;

    const workflow = analysis.model.workflow;
    const schema = this.#schemaOf(workflow.input.schema);
    return {
      namespace: structure.namespace,
      name: structure.name,
      title: structure.title,
      summary: workflow.document.summary,
      input: { schema },
      triggers: structure.triggers,
      steps: structure.steps,
    };
  }

  #schemaOf(schema: ast.Schema | null): InputSchema | null {
    if (schema?.kind !== "inline") return null;

    return { format: schema.format, document: schema.document };
  }

  #checked(filter: JsonValue): FilterCheck {
    const compilation = this.interpreter.filter(filter);

    if (compilation.kind === "refused")
      return { kind: "refused", diagnostics: compilation.diagnostics };

    return { kind: "compiled" };
  }

  #accepting(
    filters: readonly NamedFilter[],
    event: CloudEvent,
  ): readonly string[] {
    const accepting = filters.filter((named) => {
      const filter = this.#filterOf(named.filter);
      return filter?.accepts(event) ?? false;
    });
    return accepting.map((named) => named.name);
  }

  #compiledOf(versionId: string, source: CompileSource): Program | null {
    const compilation = this.#compilationOf(source);
    const program =
      compilation.kind === "compiled" ? compilation.program : null;
    this.#keep(this.#programs, versionId, program);
    return program;
  }

  #compilationOf(source: CompileSource): ReturnType<Interpreter["compile"]> {
    const options = {
      profile: source.profile,
      imports: source.imports,
    };
    return this.interpreter.compile(source.document, options);
  }

  #filterOf(filter: JsonValue): EventFilter | null {
    const key = JSON.stringify(filter);
    const kept = this.#filters.get(key);

    if (kept !== undefined) return kept;

    const compilation = this.interpreter.filter(filter);
    const compiled =
      compilation.kind === "compiled" ? compilation.filter : null;
    this.#keep(this.#filters, key, compiled);
    return compiled;
  }

  #keep<T>(cache: Map<string, T>, key: string, value: T): void {
    cache.delete(key);
    const [oldest] = cache.keys();
    const full = cache.size >= InterpreterWorker.KEPT;

    if (full && oldest !== undefined) cache.delete(oldest);

    cache.set(key, value);
  }

  #faultOf(error: unknown): WorkerAnswer<never> {
    if (error instanceof Error)
      return { kind: "fault", name: error.name, message: error.message };

    const message = String(error);
    return { kind: "fault", name: "Error", message };
  }
}
