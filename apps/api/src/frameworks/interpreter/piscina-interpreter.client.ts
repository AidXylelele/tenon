import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { ResilienceService, ResilienceTimeoutError } from "@nestjs/resilience";
import {
  context,
  metrics,
  type ObservableGauge,
  type ObservableResult,
  propagation,
} from "@opentelemetry/api";
import {
  type CloudEvent,
  type EffectResponse,
  type Ending,
  endingOf,
  type HostEnd,
  type HostProfile,
  type InputProblem,
  type InterpreterOptions,
  type JsonObject,
  type JsonValue,
  type LifecycleEventTypes,
  lifecycleEventTypesOf,
  type RuntimeDescriptor,
  type StartContext,
  type State,
  type Step,
  type StepContext,
} from "interpreter";
import type { Imports } from "interpreter/front-end";
import { LRUCache } from "lru-cache";
import { Piscina } from "piscina";
import { PermanentFault } from "../../interface-adapters/workflows/permanent-fault.error.js";
import type {
  CompilationData,
  FilterCheck,
  InterpreterClient,
  NamedFilter,
  ProgramCall,
  ProgramSource,
  ProgramStep,
  RouteMatch,
  StartedStep,
  StructureClient,
  VersionStructure,
} from "../../interface-adapters/workflows/interfaces.js";
import type {
  CompileSource,
  InterpreterThreads,
  KeptStructure,
  PoolName,
  StepTaskName,
  TaskCall,
  TaskName,
  TaskValue,
  ThreadProgram,
  ThreadTask,
  TraceCarrier,
  TaskAnswer,
  ThreadPool,
} from "./interfaces.js";
import { Instrumentation } from "../opentelemetry/enums.js";
import { RELEASE_VERSION } from "../release.js";
import { HOST_PROFILE } from "./host-profile.js";

@Injectable()
export class PiscinaInterpreterClient
  implements
    InterpreterClient,
    StructureClient,
    OnModuleInit,
    OnApplicationShutdown
{
  private static readonly MOST_KEPT_STRUCTURES = 1_000;
  private static readonly NOT_STARTED =
    "The interpreter has not started its threads";

  private readonly structures = new LRUCache<
    string,
    KeptStructure,
    ProgramSource
  >({
    max: PiscinaInterpreterClient.MOST_KEPT_STRUCTURES,
    fetchMethod: (_versionId, _kept, { context: source }) =>
      this.#keptStructureOf(source),
  });
  private readonly descriptor: RuntimeDescriptor;
  private runs: ThreadPool | null = null;
  private checks: ThreadPool | null = null;

  constructor(
    private readonly resilience: ResilienceService,
    private readonly options: InterpreterOptions,
    private readonly threads: InterpreterThreads,
  ) {
    this.descriptor = this.#descriptorOf();
  }

  async onModuleInit(): Promise<void> {
    const runs: ThreadPool = {
      name: "runs",
      threads: this.#threadsOf(this.threads.runs),
      policy: this.resilience.preset("interpreter"),
      bulkhead: this.resilience.bulkhead("interpreter"),
    };
    const checks: ThreadPool = {
      name: "checks",
      threads: this.#threadsOf(this.threads.checks),
      policy: this.resilience.preset("interpreter-checks"),
      bulkhead: this.resilience.bulkhead("interpreter-checks"),
    };
    const booting = [this.#booted(runs), this.#booted(checks)];
    await Promise.all(booting);
    this.runs = runs;
    this.checks = checks;
    const queues = this.#queuesGauge();
    queues.addCallback((result) => this.#queuesObserved(result));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runs?.threads.close();
    await this.checks?.threads.close();
  }

  async structureOf(
    versionId: string,
    source: ProgramSource,
  ): Promise<VersionStructure | null> {
    const options = { context: source };
    const kept = await this.structures.forceFetch(versionId, options);
    return kept.structure;
  }

  tagOf(digest: string): string {
    return `${digest}.${this.descriptor.version}`;
  }

  async compile(
    document: JsonObject | string,
    secrets: readonly string[],
    imports: Imports,
  ): Promise<CompilationData> {
    const profile = this.profile(secrets);
    const source = { document, profile, imports };

    const pool = this.#checks();

    try {
      return await this.#called(pool, "compile", source, null);
    } catch (error) {
      const timedOut =
        error instanceof PermanentFault &&
        error.cause instanceof ResilienceTimeoutError;

      if (timedOut) return { kind: "expired" };

      throw error;
    }
  }

  start(
    call: ProgramCall,
    input: JsonValue,
    context: StartContext,
  ): Promise<StartedStep> {
    const pool = this.#runs();
    return this.#program(pool, "start", call, (program) => ({
      program,
      input,
      context,
    }));
  }

  correlate(call: ProgramCall, context: StartContext): Promise<StartedStep> {
    const pool = this.#runs();
    return this.#program(pool, "correlate", call, (program) => ({
      program,
      context,
    }));
  }

  respond(
    call: ProgramCall,
    state: State,
    response: EffectResponse,
    context: StepContext,
  ): Promise<ProgramStep> {
    return this.#stepped("respond", call, (program) => ({
      program,
      state,
      response,
      context,
    }));
  }

  suspend(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep> {
    return this.#stepped("suspend", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  resume(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep> {
    return this.#stepped("resume", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  cancel(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep> {
    return this.#stepped("cancel", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  route(call: ProgramCall, event: CloudEvent): Promise<readonly RouteMatch[]> {
    const pool = this.#checks();
    return this.#program(pool, "route", call, (program) => ({
      program,
      event,
    }));
  }

  inputProblemsOf(
    call: ProgramCall,
    input: JsonValue,
  ): Promise<readonly InputProblem[]> {
    const pool = this.#checks();
    return this.#program(pool, "input", call, (program) => ({
      program,
      input,
    }));
  }

  filter(filter: JsonValue): Promise<FilterCheck> {
    const pool = this.#checks();
    return this.#called(pool, "filter", filter, null);
  }

  accepting(
    filters: readonly NamedFilter[],
    event: CloudEvent,
    signal: AbortSignal | null,
  ): Promise<readonly string[]> {
    const pool = this.#checks();
    const call = { filters, event };
    return this.#called(pool, "accepting", call, signal);
  }

  profile(secrets: readonly string[]): Required<HostProfile> {
    return { ...HOST_PROFILE, secrets };
  }

  runtime(): RuntimeDescriptor {
    return this.descriptor;
  }

  ending(end: HostEnd): Ending {
    return endingOf(end, this.options);
  }

  lifecycleEventTypes(): LifecycleEventTypes {
    return lifecycleEventTypesOf(this.options);
  }

  async #program<N extends TaskName>(
    pool: ThreadPool,
    name: N,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => TaskCall<N>,
  ): Promise<TaskValue<N>> {
    const answer = await this.#programAnswer(pool, name, call, callOf);
    return this.#unwrapped(answer);
  }

  async #stepped(
    name: StepTaskName,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => TaskCall<StepTaskName>,
  ): Promise<ProgramStep> {
    const pool = this.#runs();
    const answer = await this.#programAnswer(pool, name, call, callOf);
    return this.#steppedOf(answer);
  }

  async #programAnswer<N extends TaskName>(
    pool: ThreadPool,
    name: N,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => TaskCall<N>,
  ): Promise<TaskAnswer<TaskValue<N>>> {
    const cached = {
      versionId: call.versionId,
      fingerprint: call.fingerprint,
      source: null,
    };
    const cachedCall = callOf(cached);
    const first = await this.#answer(pool, name, cachedCall, call.signal);

    if (first.kind !== "missing") return first;

    const source = await call.source();
    const compileSource = this.#compileSourceOf(source);
    const compiled = {
      versionId: call.versionId,
      fingerprint: call.fingerprint,
      source: compileSource,
    };
    const compiledCall = callOf(compiled);
    return this.#answer(pool, name, compiledCall, call.signal);
  }

  async #keptStructureOf(source: ProgramSource): Promise<KeptStructure> {
    const pool = this.#checks();
    const compileSource = this.#compileSourceOf(source);
    const structure = await this.#called(
      pool,
      "structure",
      compileSource,
      null,
    );
    return { structure };
  }

  #compileSourceOf(source: ProgramSource): CompileSource {
    const profile = this.profile(source.secrets);
    return { document: source.document, profile, imports: source.imports };
  }

  async #called<N extends TaskName>(
    pool: ThreadPool,
    name: N,
    call: TaskCall<N>,
    signal: AbortSignal | null,
  ): Promise<TaskValue<N>> {
    const answer = await this.#answer(pool, name, call, signal);
    return this.#unwrapped(answer);
  }

  async #answer<N extends TaskName>(
    pool: ThreadPool,
    name: N,
    call: TaskCall<N>,
    signal: AbortSignal | null,
  ): Promise<TaskAnswer<TaskValue<N>>> {
    const task = this.#taskOf(pool.name, call);
    const options = signal === null ? {} : { signal };

    try {
      const answer: unknown = await pool.policy.execute(
        (attempt) => pool.threads.run(task, { name, signal: attempt.signal }),
        options,
      );
      return answer as TaskAnswer<TaskValue<N>>;
    } catch (error) {
      if (signal?.aborted === true) throw error;

      const exhausted = this.#exhausted(error);

      if (exhausted)
        throw new PermanentFault("The interpreter ran out of time or memory", {
          cause: error,
        });

      throw error;
    }
  }

  #taskOf<C>(pool: PoolName, call: C): ThreadTask<C> {
    const trace: TraceCarrier = {};
    const active = context.active();
    propagation.inject(active, trace);
    const enqueuedAt = Date.now();
    return { call, pool, enqueuedAt, trace };
  }

  #exhausted(error: unknown): boolean {
    if (error instanceof ResilienceTimeoutError) return true;

    const code: unknown =
      error instanceof Error ? Reflect.get(error, "code") : undefined;
    return code === "ERR_WORKER_OUT_OF_MEMORY";
  }

  #runs(): ThreadPool {
    if (this.runs === null)
      throw new TypeError(PiscinaInterpreterClient.NOT_STARTED);

    return this.runs;
  }

  #checks(): ThreadPool {
    if (this.checks === null)
      throw new TypeError(PiscinaInterpreterClient.NOT_STARTED);

    return this.checks;
  }

  #steppedOf(answer: TaskAnswer<Step>): ProgramStep {
    if (answer.kind === "incompatible") return { kind: "incompatible" };

    const step = this.#unwrapped(answer);
    return { kind: "played", step };
  }

  #unwrapped<T>(answer: TaskAnswer<T>): T {
    switch (answer.kind) {
      case "answered":
        return answer.value;
      case "fault":
        throw new Error(
          `The interpreter refused the call: ${answer.name}: ${answer.message}`,
        );
      case "missing":
        throw new Error("The interpreter did not keep the program");
      case "incompatible":
        throw new Error("The interpreter does not rebuild the run's program");
    }
  }

  #descriptorOf(): RuntimeDescriptor {
    return { name: "tenon", version: RELEASE_VERSION, metadata: {} };
  }

  #queuesGauge(): ObservableGauge {
    const meter = metrics.getMeter(Instrumentation.Scope);
    return meter.createObservableGauge("tenon.interpreter.pool.queue.length", {
      unit: "{task}",
      description: "The tasks waiting for a thread of an interpreter pool.",
    });
  }

  #queuesObserved(result: ObservableResult): void {
    const pools = [this.#runs(), this.#checks()];

    for (const pool of pools) {
      const length = pool.bulkhead.queued + pool.threads.queueSize;
      const attributes = { "tenon.interpreter.pool": pool.name };
      result.observe(length, attributes);
    }
  }

  async #booted(pool: ThreadPool): Promise<void> {
    const count = pool.threads.maxThreads;
    const readiness = Array.from({ length: count }, () => {
      const task = this.#taskOf(pool.name, null);
      return pool.threads.run(task, { name: "ready" });
    });
    await Promise.all(readiness);
  }

  #threadsOf(count: number): Piscina {
    const path = fileURLToPath(import.meta.url);
    const extension = extname(path);
    const thread = `./interpreter.thread${extension}`;
    const filename = new URL(thread, import.meta.url).href;
    return new Piscina({
      filename,
      minThreads: count,
      maxThreads: count,
      atomics: "async",
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
  }
}
