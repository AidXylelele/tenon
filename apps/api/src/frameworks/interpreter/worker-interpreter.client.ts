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
  type JsonObject,
  type JsonValue,
  type RuntimeDescriptor,
  type StartContext,
  type State,
  type Step,
  type StepContext,
} from "interpreter";
import { LRUCache } from "lru-cache";
import { Piscina } from "piscina";
import { PermanentFault } from "../../domain/errors.js";
import { IncompatibleRun } from "../../interface-adapters/workflows/incompatible-run.error.js";
import type { VersionProgram } from "../../application/automation/workflows/interfaces.js";
import {
  type CompilationData,
  type FilterCheck,
  InterpreterClient,
  type NamedFilter,
  type ProgramCall,
  type RouteMatch,
  type StartedStep,
  type StructureClient,
  type VersionStructure,
} from "../../interface-adapters/workflows/interfaces.js";
import type {
  KeptStructure,
  PoolName,
  TaskCall,
  TaskName,
  TaskValue,
  ThreadProgram,
  ThreadTask,
  TraceCarrier,
  WorkerAnswer,
  WorkerPool,
} from "./interfaces.js";
import type { ImportTexts } from "../../domain/automation/workflows/interfaces.js";
import { RELEASE_VERSION } from "../release.js";
import { HOST_PROFILE } from "./host-profile.js";

const NOT_STARTED = "The interpreter has not started its threads";

@Injectable()
export class WorkerInterpreterClient
  extends InterpreterClient
  implements StructureClient, OnModuleInit, OnApplicationShutdown
{
  static readonly RUN_THREADS = 10;
  static readonly CHECK_THREADS = 2;
  private static readonly IDLE_RUN_THREAD_MS = 60_000;
  private static readonly MOST_KEPT_STRUCTURES = 1_000;

  readonly #structures = new LRUCache<string, KeptStructure, VersionProgram>({
    max: WorkerInterpreterClient.MOST_KEPT_STRUCTURES,
    fetchMethod: (_versionId, _kept, { context: program }) =>
      this.#keptStructureOf(program),
  });
  private readonly descriptor: RuntimeDescriptor;
  private runs: WorkerPool | null = null;
  private checks: WorkerPool | null = null;

  constructor(private readonly resilience: ResilienceService) {
    super();
    this.descriptor = this.#descriptorOf();
  }

  onModuleInit(): void {
    this.runs = {
      name: "runs",
      threads: this.#threadsOf(
        0,
        WorkerInterpreterClient.RUN_THREADS,
        WorkerInterpreterClient.IDLE_RUN_THREAD_MS,
      ),
      policy: this.resilience.preset("interpreter"),
    };
    this.checks = {
      name: "checks",
      threads: this.#threadsOf(
        WorkerInterpreterClient.CHECK_THREADS,
        WorkerInterpreterClient.CHECK_THREADS,
        0,
      ),
      policy: this.resilience.preset("interpreter-checks"),
    };
    const queues = this.#queuesGauge();
    queues.addCallback((result) => this.#queuesObserved(result));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runs?.threads.close();
    await this.checks?.threads.close();
  }

  async structureOf(program: VersionProgram): Promise<VersionStructure | null> {
    const options = { context: program };
    const kept = await this.#structures.forceFetch(program.versionId, options);
    return kept.structure;
  }

  tagOf(program: VersionProgram): string {
    return `${program.digest}.${this.descriptor.version}`;
  }

  async compile(
    document: JsonObject | string,
    secrets: readonly string[],
    imports: ImportTexts,
  ): Promise<CompilationData> {
    const profile = this.profile(secrets);
    const source = { document, profile, imports };

    try {
      return await this.#called(this.#checks(), "compile", source, null);
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
    return this.#program(this.#runs(), "start", call, (program) => ({
      program,
      input,
      context,
    }));
  }

  correlate(call: ProgramCall, context: StartContext): Promise<StartedStep> {
    return this.#program(this.#runs(), "correlate", call, (program) => ({
      program,
      context,
    }));
  }

  respond(
    call: ProgramCall,
    state: State,
    response: EffectResponse,
    context: StepContext,
  ): Promise<Step> {
    return this.#program(this.#runs(), "respond", call, (program) => ({
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
  ): Promise<Step> {
    return this.#program(this.#runs(), "suspend", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  resume(call: ProgramCall, state: State, context: StepContext): Promise<Step> {
    return this.#program(this.#runs(), "resume", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  cancel(call: ProgramCall, state: State, context: StepContext): Promise<Step> {
    return this.#program(this.#runs(), "cancel", call, (program) => ({
      program,
      state,
      context,
    }));
  }

  route(call: ProgramCall, event: CloudEvent): Promise<readonly RouteMatch[]> {
    return this.#program(this.#checks(), "route", call, (program) => ({
      program,
      event,
    }));
  }

  inputProblemsOf(
    call: ProgramCall,
    input: JsonValue,
  ): Promise<readonly InputProblem[]> {
    return this.#program(this.#checks(), "input", call, (program) => ({
      program,
      input,
    }));
  }

  filter(filter: JsonValue): Promise<FilterCheck> {
    return this.#called(this.#checks(), "filter", filter, null);
  }

  accepting(
    filters: readonly NamedFilter[],
    event: CloudEvent,
    signal: AbortSignal | null,
  ): Promise<readonly string[]> {
    const call = { filters, event };
    return this.#called(this.#checks(), "accepting", call, signal);
  }

  profile(secrets: readonly string[]): Required<HostProfile> {
    return { ...HOST_PROFILE, secrets };
  }

  runtime(): RuntimeDescriptor {
    return this.descriptor;
  }

  ending(end: HostEnd): Ending {
    return endingOf(end);
  }

  async #program<N extends TaskName>(
    pool: WorkerPool,
    name: N,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => TaskCall<N>,
  ): Promise<TaskValue<N>> {
    const answer = await this.#programAnswer(pool, name, call, callOf);
    return this.#unwrapped(answer);
  }

  async #programAnswer<N extends TaskName>(
    pool: WorkerPool,
    name: N,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => TaskCall<N>,
  ): Promise<WorkerAnswer<TaskValue<N>>> {
    const cached = {
      versionId: call.versionId,
      fingerprint: call.fingerprint,
      source: null,
    };
    const cachedCall = callOf(cached);
    const first = await this.#answer(pool, name, cachedCall, call.signal);

    if (first.kind !== "missing") return first;

    const source = await call.source();
    const profile = this.profile(source.secrets);
    const document = source.document;
    const imports = source.imports;
    const compiled = {
      versionId: call.versionId,
      fingerprint: call.fingerprint,
      source: { document, profile, imports },
    };
    const compiledCall = callOf(compiled);
    return this.#answer(pool, name, compiledCall, call.signal);
  }

  async #keptStructureOf(program: VersionProgram): Promise<KeptStructure> {
    const profile = this.profile(program.secrets);
    const document = program.document as JsonObject;
    const imports = program.imports;
    const source = { document, profile, imports };
    const structure = await this.#called(
      this.#checks(),
      "structure",
      source,
      null,
    );
    return { structure };
  }

  async #called<N extends TaskName>(
    pool: WorkerPool,
    name: N,
    call: TaskCall<N>,
    signal: AbortSignal | null,
  ): Promise<TaskValue<N>> {
    const answer = await this.#answer(pool, name, call, signal);
    return this.#unwrapped(answer);
  }

  async #answer<N extends TaskName>(
    pool: WorkerPool,
    name: N,
    call: TaskCall<N>,
    signal: AbortSignal | null,
  ): Promise<WorkerAnswer<TaskValue<N>>> {
    const task = this.#taskOf(pool.name, call);
    const options = signal === null ? {} : { signal };

    try {
      const answer: unknown = await pool.policy.execute(
        (attempt) => pool.threads.run(task, { name, signal: attempt.signal }),
        options,
      );
      return answer as WorkerAnswer<TaskValue<N>>;
    } catch (error) {
      if (signal?.aborted === true) throw error;

      if (this.#exhausted(error))
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

  #runs(): WorkerPool {
    if (this.runs === null) throw new TypeError(NOT_STARTED);

    return this.runs;
  }

  #checks(): WorkerPool {
    if (this.checks === null) throw new TypeError(NOT_STARTED);

    return this.checks;
  }

  #unwrapped<T>(answer: WorkerAnswer<T>): T {
    switch (answer.kind) {
      case "answered":
        return answer.value;
      case "fault":
        throw new PermanentFault(
          `The interpreter refused the call: ${answer.name}: ${answer.message}`,
        );
      case "missing":
        throw new PermanentFault("The interpreter did not keep the program");
      case "incompatible":
        throw new IncompatibleRun();
    }
  }

  #descriptorOf(): RuntimeDescriptor {
    return { name: "tenon", version: RELEASE_VERSION, metadata: {} };
  }

  #queuesGauge(): ObservableGauge {
    const meter = metrics.getMeter("tenon-api");
    return meter.createObservableGauge("tenon.interpreter.pool.queue.length", {
      unit: "{task}",
      description: "The tasks waiting in an interpreter pool's queue.",
    });
  }

  #queuesObserved(result: ObservableResult): void {
    const pools = [this.#runs(), this.#checks()];

    for (const pool of pools) {
      const length = pool.threads.queueSize;
      const attributes = { "tenon.interpreter.pool": pool.name };
      result.observe(length, attributes);
    }
  }

  #threadsOf(least: number, most: number, idleMs: number): Piscina {
    const extension = extname(fileURLToPath(import.meta.url));
    const thread = `./interpreter.thread${extension}`;
    const filename = new URL(thread, import.meta.url).href;
    return new Piscina({
      filename,
      minThreads: least,
      maxThreads: most,
      idleTimeout: idleMs,
      atomics: "async",
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
  }
}
