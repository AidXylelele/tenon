import { Inject, Injectable } from "@nestjs/common";
import {
  context,
  type Histogram,
  metrics,
  propagation,
  ROOT_CONTEXT,
} from "@opentelemetry/api";
import type {
  CloudEvent,
  EventFilter,
  InputProblem,
  Interpreter,
  JsonObject,
  JsonValue,
  Program,
  Step,
} from "interpreter";
import type { Analysis, ast } from "interpreter/front-end";
import { structureOf } from "language-server/structure";
import { LRUCache } from "lru-cache";
import type {
  CompilationData,
  FilterCheck,
  InputSchema,
  NamedFilter,
  RouteMatch,
  StartedStep,
  VersionStructure,
} from "../../interface-adapters/workflows/interfaces.js";
import { Instrumentation } from "../opentelemetry/enums.js";
import { durationBoundaries } from "../opentelemetry/histogram.presets.js";
import type {
  AcceptingCall,
  CompileSource,
  ControlCall,
  CorrelateCall,
  InputCall,
  KeptFilter,
  KeptProgram,
  ProgramTaskCall,
  RespondCall,
  RouteCall,
  StartCall,
  ThreadProgram,
  ThreadTask,
  TaskAnswer,
} from "./interfaces.js";

@Injectable()
export class InterpreterTasks {
  static readonly INTERPRETER = "interpreter";
  private static readonly KEPT = 1_000;
  private static readonly MILLISECONDS_PER_SECOND = 1_000;

  readonly #programs = new LRUCache<string, KeptProgram, CompileSource>({
    max: InterpreterTasks.KEPT,
    memoMethod: (_versionId, _kept, { context: source }) =>
      this.#keptProgramOf(source),
  });
  readonly #filters = new LRUCache<string, KeptFilter, JsonValue>({
    max: InterpreterTasks.KEPT,
    memoMethod: (_key, _kept, { context: filter }) =>
      this.#keptFilterOf(filter),
  });
  readonly #wait: Histogram;

  constructor(
    @Inject(InterpreterTasks.INTERPRETER)
    private readonly interpreter: Interpreter,
  ) {
    const meter = metrics.getMeter(Instrumentation.Scope);
    this.#wait = meter.createHistogram("tenon.interpreter.pool.wait.duration", {
      unit: "s",
      description: "The time a task waits for an interpreter thread.",
      advice: { explicitBucketBoundaries: durationBoundaries },
    });
  }

  compile(task: ThreadTask<CompileSource>): TaskAnswer<CompilationData> {
    return this.#answered(task, (source) => this.#compiled(source));
  }

  structure(
    task: ThreadTask<CompileSource>,
  ): TaskAnswer<VersionStructure | null> {
    return this.#answered(task, (source) => this.#structured(source));
  }

  filter(task: ThreadTask<JsonValue>): TaskAnswer<FilterCheck> {
    return this.#answered(task, (filter) => this.#checked(filter));
  }

  accepting(task: ThreadTask<AcceptingCall>): TaskAnswer<readonly string[]> {
    return this.#answered(task, (call) =>
      this.#accepting(call.filters, call.event),
    );
  }

  start(task: ThreadTask<StartCall>): TaskAnswer<StartedStep> {
    return this.#played(task, (program, call) => {
      const step = program.start(call.input, call.context);
      return this.#started(program, step);
    });
  }

  correlate(task: ThreadTask<CorrelateCall>): TaskAnswer<StartedStep> {
    return this.#played(task, (program, call) => {
      const step = program.correlate(call.context);
      return this.#started(program, step);
    });
  }

  respond(task: ThreadTask<RespondCall>): TaskAnswer<Step> {
    return this.#played(task, (program, call) =>
      program.respond(call.state, call.response, call.context),
    );
  }

  suspend(task: ThreadTask<ControlCall>): TaskAnswer<Step> {
    return this.#played(task, (program, call) =>
      program.suspend(call.state, call.context),
    );
  }

  resume(task: ThreadTask<ControlCall>): TaskAnswer<Step> {
    return this.#played(task, (program, call) =>
      program.resume(call.state, call.context),
    );
  }

  cancel(task: ThreadTask<ControlCall>): TaskAnswer<Step> {
    return this.#played(task, (program, call) =>
      program.cancel(call.state, call.context),
    );
  }

  route(task: ThreadTask<RouteCall>): TaskAnswer<readonly RouteMatch[]> {
    return this.#played(task, (program, call) =>
      this.#routes(program, call.event),
    );
  }

  input(task: ThreadTask<InputCall>): TaskAnswer<readonly InputProblem[]> {
    return this.#played(task, (program, call) =>
      program.inputProblemsOf(call.input),
    );
  }

  #answered<C, T>(task: ThreadTask<C>, work: (call: C) => T): TaskAnswer<T> {
    return this.#ran(task, (call) => ({ kind: "answered", value: work(call) }));
  }

  #played<C extends ProgramTaskCall, T>(
    task: ThreadTask<C>,
    play: (program: Program, call: C) => T,
  ): TaskAnswer<T> {
    return this.#ran(task, (call) => this.#ofProgram(call, play));
  }

  #ran<C, T>(
    task: ThreadTask<C>,
    answer: (call: C) => TaskAnswer<T>,
  ): TaskAnswer<T> {
    this.#waited(task);
    const extracted = propagation.extract(ROOT_CONTEXT, task.trace);
    return context.with(extracted, () => this.#guarded(task.call, answer));
  }

  #waited(task: ThreadTask<unknown>): void {
    const waited = Date.now() - task.enqueuedAt;
    const seconds = waited / InterpreterTasks.MILLISECONDS_PER_SECOND;
    const attributes = { "tenon.interpreter.pool": task.pool };
    this.#wait.record(seconds, attributes);
  }

  #guarded<C, T>(call: C, answer: (call: C) => TaskAnswer<T>): TaskAnswer<T> {
    try {
      return answer(call);
    } catch (error) {
      return this.#faultOf(error);
    }
  }

  #ofProgram<C extends ProgramTaskCall, T>(
    call: C,
    play: (program: Program, call: C) => T,
  ): TaskAnswer<T> {
    const kept = this.#programOf(call.program);

    if (kept === undefined) return { kind: "missing" };

    return this.#playedBy(kept.program, call, play);
  }

  #programOf(thread: ThreadProgram): KeptProgram | undefined {
    if (thread.source === null) return this.#programs.get(thread.versionId);

    return this.#programs.memo(thread.versionId, { context: thread.source });
  }

  #playedBy<C extends ProgramTaskCall, T>(
    program: Program | null,
    call: C,
    play: (program: Program, call: C) => T,
  ): TaskAnswer<T> {
    const required = call.program.fingerprint;

    if (required !== null && program?.fingerprint !== required)
      return { kind: "incompatible" };

    if (program === null)
      throw new TypeError(
        `The version ${call.program.versionId} does not compile`,
      );

    return { kind: "answered", value: play(program, call) };
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

  #keptProgramOf(source: CompileSource): KeptProgram {
    const compilation = this.#compilationOf(source);
    const program =
      compilation.kind === "compiled" ? compilation.program : null;
    return { program };
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
    const kept = this.#filters.memo(key, { context: filter });
    return kept.filter;
  }

  #keptFilterOf(filter: JsonValue): KeptFilter {
    const compilation = this.interpreter.filter(filter);
    const compiled =
      compilation.kind === "compiled" ? compilation.filter : null;
    return { filter: compiled };
  }

  #faultOf(error: unknown): TaskAnswer<never> {
    if (error instanceof Error)
      return { kind: "fault", name: error.name, message: error.message };

    const message = String(error);
    return { kind: "fault", name: "Error", message };
  }
}
