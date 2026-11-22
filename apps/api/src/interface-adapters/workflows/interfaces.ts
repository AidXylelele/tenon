import type {
  AsyncApiRequest,
  Diagnostic,
  Effect,
  EffectOutcome,
  JsonObject,
  JsonValue,
  Manifest,
  RoutingFilter,
  State,
  Step,
  WorkflowRequest,
} from "interpreter";
import type { WorkflowStructure } from "language-server/structure";
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
