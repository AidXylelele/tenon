import type {
  CloudEvent,
  EffectResponse,
  EventFilter,
  HostProfile,
  JsonObject,
  JsonValue,
  Program,
  StartContext,
  State,
  StepContext,
} from "interpreter";
import type { Imports } from "interpreter/front-end";
import type { BulkheadPolicy, ResiliencePolicy } from "@nestjs/resilience";
import type { Piscina } from "piscina";
import type {
  NamedFilter,
  VersionStructure,
} from "../../interface-adapters/interpreter/interfaces.js";
import type * as thread from "./interpreter.thread.js";

export interface CompileSource {
  readonly document: JsonObject | string;
  readonly profile: HostProfile;
  readonly imports: Imports;
}

export interface ThreadProgram {
  readonly versionId: string;
  readonly fingerprint: string | null;
  readonly source: CompileSource | null;
}

export interface AcceptingCall {
  readonly filters: readonly NamedFilter[];
  readonly event: CloudEvent;
}

export interface ProgramTaskCall {
  readonly program: ThreadProgram;
}

export interface StartCall extends ProgramTaskCall {
  readonly input: JsonValue;
  readonly context: StartContext;
}

export interface CorrelateCall extends ProgramTaskCall {
  readonly context: StartContext;
}

export interface RespondCall extends ProgramTaskCall {
  readonly state: State;
  readonly response: EffectResponse;
  readonly context: StepContext;
}

export interface ControlCall extends ProgramTaskCall {
  readonly state: State;
  readonly context: StepContext;
}

export interface RouteCall extends ProgramTaskCall {
  readonly event: CloudEvent;
}

export interface InputCall extends ProgramTaskCall {
  readonly input: JsonValue;
}

type ThreadTasks = typeof thread;

export type TaskName = keyof ThreadTasks;

export type StepTaskName = "respond" | "suspend" | "resume" | "cancel";

export type TaskCall<N extends TaskName> = Parameters<
  ThreadTasks[N]
>[0]["call"];

export type TaskValue<N extends TaskName> =
  ReturnType<ThreadTasks[N]> extends TaskAnswer<infer V> ? V : never;

export type PoolName = "runs" | "checks";

export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
}

export interface ThreadTask<C> {
  readonly call: C;
  readonly pool: PoolName;
  readonly enqueuedAt: number;
  readonly trace: TraceCarrier;
}

interface Answered<T> {
  readonly kind: "answered";
  readonly value: T;
}

interface MissingProgram {
  readonly kind: "missing";
}

interface IncompatibleProgram {
  readonly kind: "incompatible";
}

interface Fault {
  readonly kind: "fault";
  readonly name: string;
  readonly message: string;
}

export type TaskAnswer<T> =
  Answered<T> | MissingProgram | IncompatibleProgram | Fault;

export interface KeptProgram {
  readonly program: Program | null;
}

export interface KeptFilter {
  readonly filter: EventFilter | null;
}

export interface KeptStructure {
  readonly structure: VersionStructure | null;
}

export interface ThreadPool {
  readonly name: PoolName;
  readonly threads: Piscina;
  readonly policy: ResiliencePolicy;
  readonly bulkhead: BulkheadPolicy;
}

export interface InterpreterThreads {
  readonly runs: number;
  readonly checks: number;
}
