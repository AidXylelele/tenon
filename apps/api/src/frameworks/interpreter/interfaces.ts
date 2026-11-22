import type {
  CloudEvent,
  EffectResponse,
  HostProfile,
  JsonObject,
  JsonValue,
  StartContext,
  State,
  StepContext,
} from "interpreter";
import type { ResiliencePolicy } from "@nestjs/resilience";
import type { Piscina } from "piscina";
import type {
  NamedFilter,
  StepCall,
} from "../../interface-adapters/workflows/interfaces.js";
import type { ImportTexts } from "../../domain/automation/workflows/interfaces.js";

export interface CompileSource {
  readonly document: JsonObject | string;
  readonly profile: HostProfile;
  readonly imports: ImportTexts;
}

export interface ThreadProgram {
  readonly versionId: string;
  readonly fingerprint: string | null;
  readonly source: CompileSource | null;
}

interface CompileCall {
  readonly kind: "compile";
  readonly source: CompileSource;
}

interface StartCall {
  readonly kind: "start";
  readonly program: ThreadProgram;
  readonly input: JsonValue;
  readonly context: StartContext;
}

interface CorrelateCall {
  readonly kind: "correlate";
  readonly program: ThreadProgram;
  readonly context: StartContext;
}

interface RespondCall {
  readonly kind: "respond";
  readonly program: ThreadProgram;
  readonly state: State;
  readonly response: EffectResponse;
  readonly context: StepContext;
}

interface ControlCall {
  readonly kind: "suspend" | "resume" | "cancel";
  readonly program: ThreadProgram;
  readonly state: State;
  readonly context: StepContext;
}

interface RouteCall {
  readonly kind: "route";
  readonly program: ThreadProgram;
  readonly event: CloudEvent;
}

interface InputCall {
  readonly kind: "input";
  readonly program: ThreadProgram;
  readonly input: JsonValue;
}

interface StructureCall {
  readonly kind: "structure";
  readonly source: CompileSource;
}

interface FilterCall {
  readonly kind: "filter";
  readonly filter: JsonValue;
}

interface AcceptingCall {
  readonly kind: "accepting";
  readonly filters: readonly NamedFilter[];
  readonly event: CloudEvent;
}

export type ProgramWorkerCall =
  StartCall | CorrelateCall | RespondCall | ControlCall | RouteCall | InputCall;

export type WorkerCall =
  CompileCall | StructureCall | FilterCall | AcceptingCall | ProgramWorkerCall;

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

export type WorkerAnswer<T> =
  Answered<T> | MissingProgram | IncompatibleProgram | Fault;

export interface WorkerPool {
  readonly threads: Piscina;
  readonly policy: ResiliencePolicy;
}

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}
