import type {
  AsyncApiRequest,
  CloudEvent,
  Diagnostic,
  Effect,
  EffectOutcome,
  EffectResponse,
  Ending,
  HostEnd,
  HostProfile,
  InputProblem,
  JsonObject,
  JsonValue,
  Manifest,
  ProcessRequest,
  RoutingFilter,
  RuntimeDescriptor,
  Script,
  Shell,
  StartContext,
  State,
  Step,
  StepContext,
  WorkflowRequest,
} from "interpreter";
import type { WorkflowStructure } from "language-server/structure";
import type { VersionProgram } from "../../application/automation/workflows/interfaces.js";
import type {
  AwaitedEffect,
  TakenEvent,
} from "../../domain/automation/instances/interfaces.js";
import type { ImportTexts } from "../../domain/automation/workflows/interfaces.js";

type CompiledManifest = Omit<Manifest, "filters">;

export type RouteMatch = Omit<RoutingFilter, "accepts">;

interface CompiledData {
  readonly kind: "compiled";
  readonly manifest: CompiledManifest;
  readonly fingerprint: string;
  readonly document: JsonObject;
}

interface RefusedData {
  readonly kind: "refused";
  readonly diagnostics: readonly Diagnostic[];
}

interface ExpiredData {
  readonly kind: "expired";
}

export type CompilationData = CompiledData | RefusedData | ExpiredData;

export type FilterCheck = { readonly kind: "compiled" } | RefusedData;

export interface InputSchema {
  readonly format: string;
  readonly document: JsonValue;
}

interface VersionInput {
  readonly schema: InputSchema | null;
}

export interface VersionStructure extends WorkflowStructure {
  readonly summary: string | null;
  readonly input: VersionInput;
}

export interface ProgramSource {
  readonly document: JsonObject;
  readonly imports: ImportTexts;
  readonly secrets: readonly string[];
}

export interface ProgramCall {
  readonly versionId: string;
  readonly fingerprint: string | null;
  readonly source: () => Promise<ProgramSource>;
  readonly signal: AbortSignal | null;
}

export interface StartedStep {
  readonly step: Step;
  readonly fingerprint: string;
}

export interface NamedFilter {
  readonly name: string;
  readonly filter: JsonValue;
}

export interface Played {
  readonly steps: readonly Step[];
  readonly answered: readonly string[];
  readonly taken: TakenEvent | null;
}

export interface Program {
  readonly call: ProgramCall;
  readonly fingerprint: string;
  readonly awaited: readonly AwaitedEffect[];
}

export type ControlStep = (call: ProgramCall, state: State) => Promise<Step>;

export type ChildEffect = Effect & WorkflowRequest;

export type SandboxedProcessRequest = ProcessRequest & {
  readonly process: Script | Shell;
};

export interface StepCall {
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly secrets: JsonObject;
}

export interface TimeAnswer {
  readonly at: number;
  readonly outcome: EffectOutcome;
}

export interface TimedWait {
  readonly id: string;
  readonly answers: readonly TimeAnswer[];
}

export interface RunAgendaView {
  readonly ended: boolean;
  readonly calls: readonly Effect[];
  readonly processes: readonly Effect[];
  readonly detached: readonly Effect[];
  readonly children: readonly ChildEffect[];
  readonly receives: readonly string[];
  readonly waits: readonly TimedWait[];
}

export type ChildStart =
  | { readonly kind: "started"; readonly instanceId: string }
  | { readonly kind: "missing" };

export interface Receiver {
  readonly instanceId: string;
  readonly execution: string;
  readonly request: AsyncApiRequest;
  readonly closesAt: number | null;
}

export interface ResolvedCompilation {
  readonly compilation: CompilationData;
  readonly imports: ImportTexts;
  readonly failures: ReadonlyMap<string, string>;
}

export interface NeededImport {
  readonly reference: string;
  readonly uri: string;
}

export interface FetchedImportText {
  readonly reference: string;
  readonly text: string | null;
  readonly reason: string | null;
}

export abstract class InterpreterClient {
  abstract compile(
    source: JsonObject | string,
    secrets: readonly string[],
    imports: ImportTexts,
  ): Promise<CompilationData>;
  abstract start(
    call: ProgramCall,
    input: JsonValue,
    context: StartContext,
  ): Promise<StartedStep>;
  abstract correlate(
    call: ProgramCall,
    context: StartContext,
  ): Promise<StartedStep>;
  abstract respond(
    call: ProgramCall,
    state: State,
    response: EffectResponse,
    context: StepContext,
  ): Promise<Step>;
  abstract suspend(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<Step>;
  abstract resume(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<Step>;
  abstract cancel(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<Step>;
  abstract route(
    call: ProgramCall,
    event: CloudEvent,
  ): Promise<readonly RouteMatch[]>;
  abstract filter(filter: JsonValue): Promise<FilterCheck>;
  abstract accepting(
    filters: readonly NamedFilter[],
    event: CloudEvent,
    signal: AbortSignal | null,
  ): Promise<readonly string[]>;
  abstract inputProblemsOf(
    call: ProgramCall,
    input: JsonValue,
  ): Promise<readonly InputProblem[]>;
  abstract profile(secrets: readonly string[]): Required<HostProfile>;
  abstract runtime(): RuntimeDescriptor;
  abstract ending(end: HostEnd): Ending;
}

export abstract class StructureClient {
  abstract structureOf(
    program: VersionProgram,
  ): Promise<VersionStructure | null>;
  abstract tagOf(program: VersionProgram): string;
}

export abstract class EffectClient {
  abstract perform(effect: Effect, step: StepCall): Promise<EffectOutcome>;
  abstract performDetached(
    request: SandboxedProcessRequest,
    step: StepCall,
  ): Promise<void>;
}
