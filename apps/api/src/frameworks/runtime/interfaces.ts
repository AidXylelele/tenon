import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../domain/automation/json.js';
import type { CheckProblem } from '../../interface-adapters/workflows/interfaces.js';
import type {
  AuthorizationKind,
  EndpointOutcomeKind,
  JqOutcomeKind,
  JsonSchemaOutcomeKind,
  RequestPreparationKind,
  SandboxOutcomeKind,
} from './enums.js';

export interface JqCompiled {
  readonly kind: JqOutcomeKind.Compiled;
}

export interface JqEvaluated {
  readonly kind: JqOutcomeKind.Evaluated;
  readonly values: readonly JsonValue[];
}

export interface JqFailure {
  readonly kind: JqOutcomeKind.Failure;
  readonly failure: string;
}

// The program outlasted its time limit.
export interface JqTimedOut {
  readonly kind: JqOutcomeKind.TimedOut;
}

// jq exhausted the memory it may use.
export interface JqAborted {
  readonly kind: JqOutcomeKind.Aborted;
}

export type JqCompilation = JqCompiled | JqFailure | JqTimedOut | JqAborted;

export type JqEvaluation = JqEvaluated | JqFailure | JqTimedOut | JqAborted;

export abstract class JqClient {
  abstract compile(program: string): Promise<JqCompilation>;
  abstract evaluate(
    program: string,
    data: JsonValue,
    variables: JsonObject,
  ): Promise<JqEvaluation>;
}

export interface JsonSchemaCompiled {
  readonly kind: JsonSchemaOutcomeKind.Compiled;
}

export interface JsonSchemaValid {
  readonly kind: JsonSchemaOutcomeKind.Valid;
}

export interface JsonSchemaInvalid {
  readonly kind: JsonSchemaOutcomeKind.Invalid;
  readonly reason: string;
}

export interface JsonSchemaUnusable {
  readonly kind: JsonSchemaOutcomeKind.Unusable;
  readonly reason: string;
}

// Checking the schema or the value outlasted its time limit.
export interface JsonSchemaTimedOut {
  readonly kind: JsonSchemaOutcomeKind.TimedOut;
}

export type JsonSchemaCompilation =
  JsonSchemaCompiled | JsonSchemaUnusable | JsonSchemaTimedOut;

export type JsonSchemaVerdict =
  JsonSchemaValid | JsonSchemaInvalid | JsonSchemaUnusable | JsonSchemaTimedOut;

export abstract class JsonSchemaClient {
  abstract compile(schema: JsonObject): Promise<JsonSchemaCompilation>;
  abstract validate(
    schema: JsonObject,
    data: JsonValue,
  ): Promise<JsonSchemaVerdict>;
}

export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

export interface HeaderAuthorization {
  readonly kind: AuthorizationKind.Header;
  readonly scheme: string;
  readonly parameter: string;
}

export interface ClientCredentials {
  readonly kind: AuthorizationKind.ClientCredentials;
  readonly tokenEndpoint: string | null;
  readonly issuer: string | null;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly secretInHeader: boolean;
  readonly scopes: readonly string[];
  readonly audiences: readonly string[];
}

export type Authorization = HeaderAuthorization | ClientCredentials;

export interface SentAuthorization {
  readonly scheme: string;
  readonly parameter: string;
}

// `timeout`: the milliseconds left before the calling task's deadline; null: none.
export interface Exchange {
  readonly request: HttpRequest;
  readonly authorization: Authorization | null;
  readonly timeout: number | null;
}

export interface DocumentRequest {
  readonly url: string;
  readonly authorization: Authorization | null;
  readonly timeout: number | null;
}

export interface EndpointResponded {
  readonly kind: EndpointOutcomeKind.Responded;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
  readonly authorization: SentAuthorization | null;
}

export interface EndpointDocumentRead {
  readonly kind: EndpointOutcomeKind.Read;
  readonly document: JsonObject;
}

export interface EndpointUnreadable {
  readonly kind: EndpointOutcomeKind.Unreadable;
}

export interface EndpointRejected {
  readonly kind: EndpointOutcomeKind.Rejected;
}

export interface EndpointTimedOut {
  readonly kind: EndpointOutcomeKind.TimedOut;
}

export interface EndpointUnreachable {
  readonly kind: EndpointOutcomeKind.Unreachable;
  readonly reason: string;
}

export interface EndpointUnauthorized {
  readonly kind: EndpointOutcomeKind.Unauthorized;
  readonly reason: string;
}

// The request cannot be sent as the author wrote it (a header value undici refuses).
export interface EndpointInvalid {
  readonly kind: EndpointOutcomeKind.Invalid;
  readonly reason: string;
}

export type EndpointFailure =
  | EndpointRejected
  | EndpointTimedOut
  | EndpointUnreachable
  | EndpointUnauthorized
  | EndpointInvalid;

export type ExchangeOutcome = EndpointResponded | EndpointFailure;

export type DocumentOutcome =
  EndpointDocumentRead | EndpointUnreadable | EndpointFailure;

export interface PreparedRequest {
  readonly kind: RequestPreparationKind.Prepared;
  readonly request: HttpRequest;
}

export interface MisconfiguredRequest {
  readonly kind: RequestPreparationKind.Misconfigured;
  readonly reason: string;
}

export type RequestPreparation = PreparedRequest | MisconfiguredRequest;

export abstract class EndpointClient {
  abstract exchange(exchange: Exchange): Promise<ExchangeOutcome>;
  abstract read(request: DocumentRequest): Promise<DocumentOutcome>;
}

export abstract class SandboxLimits {
  abstract readonly seconds: number;
  abstract readonly memoryBytes: number;
  abstract readonly processes: number;
  abstract readonly outputBytes: number;
}

export interface GoJudgeFile {
  readonly content?: string;
  readonly name?: string;
  readonly max?: number;
}

export interface GoJudgeCommand {
  readonly args: readonly string[];
  readonly env: readonly string[];
  readonly files: readonly GoJudgeFile[];
  readonly cpuLimit: number;
  readonly clockLimit: number;
  readonly memoryLimit: number;
  readonly procLimit: number;
  readonly copyIn: Readonly<Record<string, GoJudgeFile>>;
}

export interface GoJudgeResult {
  readonly status: string;
  readonly exitStatus?: number;
  readonly error?: string;
  readonly files?: Readonly<Record<string, string>>;
}

export interface SandboxRan {
  readonly kind: SandboxOutcomeKind.Ran;
  readonly result: GoJudgeResult;
}

export interface SandboxRejected {
  readonly kind: SandboxOutcomeKind.Rejected;
}

export interface SandboxTimedOut {
  readonly kind: SandboxOutcomeKind.TimedOut;
}

export interface SandboxUnreachable {
  readonly kind: SandboxOutcomeKind.Unreachable;
}

// An answer that is not the sandbox's (a proxy's page, a gateway status): an outage.
export interface SandboxUnrecognized {
  readonly kind: SandboxOutcomeKind.Unrecognized;
}

// An answer larger than its bound, which repeating the run would only repeat.
export interface SandboxOversized {
  readonly kind: SandboxOutcomeKind.Oversized;
}

// go-judge's own refusal of this command (400, 404 or 500 with its message).
export interface SandboxFailure {
  readonly kind: SandboxOutcomeKind.Failed;
}

export type SandboxOutcome =
  | SandboxRan
  | SandboxRejected
  | SandboxTimedOut
  | SandboxUnreachable
  | SandboxUnrecognized
  | SandboxOversized
  | SandboxFailure;

export abstract class SandboxClient {
  abstract run(command: GoJudgeCommand): Promise<SandboxOutcome>;
}

// One rule of what the runtime refuses to run; the first problem found is the document's.
export interface DefinitionCheck {
  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null>;
}

// How an engine step repeats: the engine waits `backoff(attempt)` milliseconds between attempts
// and repeats only an error `retries` accepts.
export interface StepRetry {
  readonly attempts: number;
  backoff(attempt: number): number;
  retries(error: unknown): boolean;
}

export interface StepOptions {
  readonly timeoutMs: number | null;
  readonly retry: StepRetry | null;
}

// What a durable engine gives the runtime: each effect runs once and its result is journaled;
// a sleep or a wait parks the run without holding a worker.
export interface Durability {
  now(): number;
  step<T>(
    name: string,
    effect: (attempt: number) => Promise<T>,
    options: StepOptions,
  ): Promise<T>;
  sleep(name: string, milliseconds: number): Promise<void>;
  // Until a resume signal, or `milliseconds` at most.
  waitForResume(name: string, milliseconds: number): Promise<void>;
  // A platform instance run as this run's child, until it ends; or started on its own.
  awaitChild(name: string, instanceId: string): Promise<void>;
  detachChild(name: string, instanceId: string): Promise<void>;
  // A process run on its own, its outcome unread.
  detachProcess(name: string, command: GoJudgeCommand): Promise<void>;
}

// The runtime's own descriptor, `$runtime` in expressions.
export interface RuntimeDescriptor {
  readonly name: string;
  readonly version: string;
}
