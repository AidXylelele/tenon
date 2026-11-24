import type {
  CloudEvent,
  Diagnostic,
  Effect,
  EffectResponse,
  Ending,
  HostEnd,
  HostProfile,
  InputProblem,
  JsonObject,
  JsonValue,
  LifecycleEventTypes,
  Manifest,
  RoutingFilter,
  RuntimeDescriptor,
  StartContext,
  State,
  Step,
  StepContext,
  WorkflowRequest,
} from "interpreter";
import type { Imports } from "interpreter/front-end";
import type { WorkflowStructure } from "language-server/structure";
import type {
  AwaitedEffect,
  TakenEvent,
} from "../../domain/automation/instances/interfaces.js";
import type { ImportTexts } from "../../domain/automation/workflows/interfaces.js";

export type JsonOf<T> = T extends JsonValue
  ? T
  : T extends readonly (infer Item)[]
    ? readonly JsonOf<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: JsonOf<T[Key]> }
      : never;

type CompiledManifest = Omit<Manifest, "filters">;

export type RouteMatch = Omit<RoutingFilter, "accepts">;

export interface CompiledData {
  readonly kind: "compiled";
  readonly manifest: CompiledManifest;
  readonly fingerprint: string;
  readonly digest: string;
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
  readonly imports: Imports;
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

export type ProgramStep =
  | { readonly kind: "played"; readonly step: Step }
  | { readonly kind: "incompatible" };

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

export type ControlStep = (
  call: ProgramCall,
  state: State,
) => Promise<ProgramStep>;

export type ChildEffect = Effect & WorkflowRequest;

export interface StepCall {
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly secrets: JsonObject;
}

export interface CallContext extends StepCall {
  readonly remaining: number | null;
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
    imports: Imports,
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
  ): Promise<ProgramStep>;
  abstract suspend(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep>;
  abstract resume(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep>;
  abstract cancel(
    call: ProgramCall,
    state: State,
    context: StepContext,
  ): Promise<ProgramStep>;
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
  abstract lifecycleEventTypes(): LifecycleEventTypes;
}

export abstract class StructureClient {
  abstract structureOf(
    versionId: string,
    source: ProgramSource,
  ): Promise<VersionStructure | null>;
  abstract tagOf(digest: string): string;
}
