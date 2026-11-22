import type {
  CloudEvent,
  EffectResponse,
  Ending,
  HostEnd,
  HostProfile,
  InputProblem,
  JsonObject,
  JsonValue,
  RuntimeDescriptor,
  StartContext,
  State,
  Step,
  StepContext,
} from "interpreter";
import type { VersionProgram } from "../../application/automation/workflows/interfaces.js";
import type {
  CompilationData,
  FilterCheck,
  NamedFilter,
  ProgramCall,
  RouteMatch,
  StartedStep,
  VersionStructure,
} from "./interfaces.js";
import type { ImportTexts } from "../../domain/automation/workflows/interfaces.js";

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
  abstract rebuilds(call: ProgramCall): Promise<boolean>;
  abstract inputProblemsOf(
    call: ProgramCall,
    input: JsonValue,
  ): Promise<readonly InputProblem[]>;
  abstract profile(secrets: readonly string[]): Required<HostProfile>;
  abstract runtime(): RuntimeDescriptor;
  abstract stateFormat(): number;
  abstract ending(end: HostEnd): Ending;
}

export abstract class StructureClient {
  abstract structureOf(
    program: VersionProgram,
  ): Promise<VersionStructure | null>;
  abstract tagOf(program: VersionProgram): string;
}
