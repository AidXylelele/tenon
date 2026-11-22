import { readFile } from "node:fs/promises";
import type { SecretPolicies } from "./api/index.js";
import { Compiler } from "./compiler.js";
import { Translator } from "./core/index.js";
import type { Interpreter } from "./interpreter.js";
import type { MachineServices } from "./machine/index.js";
import { jqLanguageOf, JsonSchemas } from "./runtime/index.js";
import { Analyzer } from "./semantics/index.js";
import { GrammarCheck, SecretPolicyCheck } from "./syntax/index.js";

export type {
  A2aRequest,
  AsyncApiInboundMessage,
  AsyncApiMessage,
  AsyncApiOutcome,
  AsyncApiRequest,
  Authentication,
  AuthenticationScheme,
  CloudEvent,
  Diagnostic,
  Effect,
  EffectOutcome,
  EffectResponse,
  EmitOutcome,
  Endpoint,
  Ending,
  EventFilter,
  Failure,
  GrpcOutcome,
  GrpcRequest,
  HostEnd,
  HostProfile,
  HttpOutcome,
  HttpRequest,
  InputProblem,
  JsonObject,
  JsonValue,
  LifecycleEvent,
  Manifest,
  McpRequest,
  OpenApiRequest,
  ProcessOutcome,
  ProcessRequest,
  Program,
  Resource,
  ResourceOutcome,
  ResourceRequest,
  ResolvedAuthentication,
  RespondedHttpOutcome,
  RevealedAuthorization,
  RoutingFilter,
  RpcOutcome,
  RuntimeDescriptor,
  Schedule,
  Script,
  SecretPolicies,
  SecretRefusal,
  Shell,
  StartContext,
  State,
  Step,
  StepContext,
  TaskValue,
  WorkflowOutcome,
  WorkflowRequest,
} from "./api/index.js";
export { stateFormatVersion } from "./core/index.js";
export { endingOf } from "./machine/index.js";
export { lifecycleEventCatalogue } from "./standard/index.js";
export type { Interpreter } from "./interpreter.js";

export async function createInterpreter(): Promise<Interpreter> {
  const location = import.meta.resolve("jq-wasm/jq.wasm");
  const engineFile = new URL(location);
  const engine = await readFile(engineFile);
  const expressions = await jqLanguageOf(engine);
  const grammar = GrammarCheck.standard();
  const schemas = new JsonSchemas([]);
  const analyzer = new Analyzer(expressions, grammar, schemas);
  const translator = new Translator(expressions, schemas);
  const services: MachineServices = { expressions, schemas };

  return new Compiler(analyzer, translator, services);
}

export function createSecretPolicies(): SecretPolicies {
  return SecretPolicyCheck.standard();
}
