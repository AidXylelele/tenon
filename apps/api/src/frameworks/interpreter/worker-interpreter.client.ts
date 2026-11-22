import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { ResilienceService, ResilienceTimeoutError } from "@nestjs/resilience";
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
  ThreadProgram,
  WorkerAnswer,
  WorkerCall,
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

  readonly #structures = new Map<string, VersionStructure | null>();
  private readonly descriptor: RuntimeDescriptor;
  private runs: WorkerPool | null = null;
  private checks: WorkerPool | null = null;

  constructor(private readonly resilience: ResilienceService) {
    super();
    this.descriptor = this.#descriptorOf();
  }

  onModuleInit(): void {
    this.runs = {
      threads: this.#threadsOf(
        0,
        WorkerInterpreterClient.RUN_THREADS,
        WorkerInterpreterClient.IDLE_RUN_THREAD_MS,
      ),
      policy: this.resilience.preset("interpreter"),
    };
    this.checks = {
      threads: this.#threadsOf(
        WorkerInterpreterClient.CHECK_THREADS,
        WorkerInterpreterClient.CHECK_THREADS,
        0,
      ),
      policy: this.resilience.preset("interpreter-checks"),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runs?.threads.close();
    await this.checks?.threads.close();
  }

  async structureOf(program: VersionProgram): Promise<VersionStructure | null> {
    const kept = this.#structures.get(program.versionId);

    if (kept !== undefined) return kept;

    const profile = this.profile(program.secrets);
    const document = program.document as JsonObject;
    const imports = program.imports;
    const call: WorkerCall = {
      kind: "structure",
      source: { document, profile, imports },
    };
    const structure = await this.#called<VersionStructure | null>(
      this.#checks(),
      call,
      null,
    );
    this.#keep(program.versionId, structure);
    return structure;
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
    const call: WorkerCall = { kind: "compile", source };

    try {
      return await this.#called<CompilationData>(this.#checks(), call, null);
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
    return this.#program<StartedStep>(this.#runs(), call, (program) => ({
      kind: "start",
      program,
      input,
      context,
    }));
  }

  correlate(call: ProgramCall, context: StartContext): Promise<StartedStep> {
    return this.#program<StartedStep>(this.#runs(), call, (program) => ({
      kind: "correlate",
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
    return this.#program<Step>(this.#runs(), call, (program) => ({
      kind: "respond",
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
    return this.#program<Step>(this.#runs(), call, (program) => ({
      kind: "suspend",
      program,
      state,
      context,
    }));
  }

  resume(call: ProgramCall, state: State, context: StepContext): Promise<Step> {
    return this.#program<Step>(this.#runs(), call, (program) => ({
      kind: "resume",
      program,
      state,
      context,
    }));
  }

  cancel(call: ProgramCall, state: State, context: StepContext): Promise<Step> {
    return this.#program<Step>(this.#runs(), call, (program) => ({
      kind: "cancel",
      program,
      state,
      context,
    }));
  }

  route(call: ProgramCall, event: CloudEvent): Promise<readonly RouteMatch[]> {
    return this.#program<readonly RouteMatch[]>(
      this.#checks(),
      call,
      (program) => ({ kind: "route", program, event }),
    );
  }

  inputProblemsOf(
    call: ProgramCall,
    input: JsonValue,
  ): Promise<readonly InputProblem[]> {
    return this.#program<readonly InputProblem[]>(
      this.#checks(),
      call,
      (program) => ({ kind: "input", program, input }),
    );
  }

  filter(filter: JsonValue): Promise<FilterCheck> {
    const call: WorkerCall = { kind: "filter", filter };
    return this.#called<FilterCheck>(this.#checks(), call, null);
  }

  accepting(
    filters: readonly NamedFilter[],
    event: CloudEvent,
    signal: AbortSignal | null,
  ): Promise<readonly string[]> {
    const call: WorkerCall = { kind: "accepting", filters, event };
    return this.#called<readonly string[]>(this.#checks(), call, signal);
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

  async #program<T>(
    pool: WorkerPool,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => WorkerCall,
  ): Promise<T> {
    const answer = await this.#programAnswer<T>(pool, call, callOf);
    return this.#unwrapped(answer);
  }

  async #programAnswer<T>(
    pool: WorkerPool,
    call: ProgramCall,
    callOf: (program: ThreadProgram) => WorkerCall,
  ): Promise<WorkerAnswer<T>> {
    const cached = {
      versionId: call.versionId,
      fingerprint: call.fingerprint,
      source: null,
    };
    const first = await this.#answer<T>(pool, callOf(cached), call.signal);

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
    return this.#answer<T>(pool, callOf(compiled), call.signal);
  }

  async #called<T>(
    pool: WorkerPool,
    call: WorkerCall,
    signal: AbortSignal | null,
  ): Promise<T> {
    const answer = await this.#answer<T>(pool, call, signal);
    return this.#unwrapped(answer);
  }

  async #answer<T>(
    pool: WorkerPool,
    call: WorkerCall,
    signal: AbortSignal | null,
  ): Promise<WorkerAnswer<T>> {
    const options = signal === null ? {} : { signal };

    try {
      const answer: unknown = await pool.policy.execute(
        (attempt) => pool.threads.run(call, { signal: attempt.signal }),
        options,
      );
      return answer as WorkerAnswer<T>;
    } catch (error) {
      if (signal?.aborted === true) throw error;

      if (this.#exhausted(error))
        throw new PermanentFault("The interpreter ran out of time or memory", {
          cause: error,
        });

      throw error;
    }
  }

  #exhausted(error: unknown): boolean {
    if (error instanceof ResilienceTimeoutError) return true;

    const code: unknown =
      error instanceof Error ? Reflect.get(error, "code") : undefined;
    return code === "ERR_WORKER_OUT_OF_MEMORY";
  }

  #keep(versionId: string, structure: VersionStructure | null): void {
    if (this.#structures.size >= WorkerInterpreterClient.MOST_KEPT_STRUCTURES)
      this.#structures.clear();

    this.#structures.set(versionId, structure);
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

  #threadsOf(least: number, most: number, idleMs: number): Piscina {
    const extension = extname(fileURLToPath(import.meta.url));
    const thread = `./interpreter.thread${extension}`;
    const filename = new URL(thread, import.meta.url).href;
    return new Piscina({
      filename,
      minThreads: least,
      maxThreads: most,
      idleTimeout: idleMs,
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
  }
}
