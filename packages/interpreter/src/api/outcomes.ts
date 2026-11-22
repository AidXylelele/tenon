import type { EffectKind } from "./effects.js";
import type { WorkflowError } from "./errors.js";
import type { CloudEvent } from "./events.js";
import type { JsonObject, JsonValue } from "./json.js";

interface ExpiredOutcome {
  readonly kind: "expired";
}

interface StartedOutcome {
  readonly kind: "started";
}

interface UnreachableFailure {
  readonly kind: "unreachable";
  readonly detail: string;
}

interface RejectedFailure {
  readonly kind: "rejected";
  readonly statusCode: number;
  readonly detail: string;
}

interface UnauthenticatedFailure {
  readonly kind: "unauthenticated";
  readonly detail: string;
}

interface ForbiddenFailure {
  readonly kind: "forbidden";
  readonly detail: string;
}

interface MisconfiguredFailure {
  readonly kind: "misconfigured";
  readonly detail: string;
}

export type Failure =
  | ExpiredOutcome
  | UnreachableFailure
  | RejectedFailure
  | UnauthenticatedFailure
  | ForbiddenFailure
  | MisconfiguredFailure;

export interface SentHttpRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface RevealedAuthorization {
  readonly scheme: string;
  readonly parameter: string;
}

export interface RespondedHttpOutcome {
  readonly kind: "responded";
  readonly request: SentHttpRequest;
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly content: JsonValue;
  readonly authorization: RevealedAuthorization | null;
}

export type HttpOutcome = RespondedHttpOutcome | Failure;

interface RepliedGrpcOutcome {
  readonly kind: "replied";
  readonly message: JsonValue;
}

interface StatusGrpcOutcome {
  readonly kind: "status";
  readonly code: number;
  readonly message: string;
}

export type GrpcOutcome = RepliedGrpcOutcome | StatusGrpcOutcome | Failure;

interface PublishedAsyncApiOutcome {
  readonly kind: "published";
}

export interface AsyncApiInboundMessage {
  readonly payload: JsonValue;
  readonly headers: JsonObject;
  readonly correlationId: string | null;
}

interface MessageAsyncApiOutcome {
  readonly kind: "message";
  readonly message: AsyncApiInboundMessage;
}

interface ClosedAsyncApiOutcome {
  readonly kind: "closed";
}

export type AsyncApiOutcome =
  | PublishedAsyncApiOutcome
  | MessageAsyncApiOutcome
  | ClosedAsyncApiOutcome
  | Failure;

interface AnsweredRpcOutcome {
  readonly kind: "answered";
  readonly result: JsonValue;
}

interface RpcErrorOutcome {
  readonly kind: "rpcError";
  readonly code: number;
  readonly message: string;
  readonly data: JsonValue;
}

export type RpcOutcome = AnsweredRpcOutcome | RpcErrorOutcome | Failure;

interface ExitedProcessOutcome {
  readonly kind: "exited";
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface UnstartedProcessOutcome {
  readonly kind: "unstarted";
  readonly detail: string;
}

interface KilledProcessOutcome {
  readonly kind: "killed";
  readonly detail: string;
}

export type ProcessOutcome =
  | ExitedProcessOutcome
  | StartedOutcome
  | UnstartedProcessOutcome
  | KilledProcessOutcome
  | Failure;

interface CompletedWorkflowOutcome {
  readonly kind: "completed";
  readonly output: JsonValue;
}

interface FaultedWorkflowOutcome {
  readonly kind: "faulted";
  readonly error: WorkflowError;
}

interface CancelledWorkflowOutcome {
  readonly kind: "cancelled";
}

interface MissingWorkflowOutcome {
  readonly kind: "missing";
}

export type WorkflowOutcome =
  | CompletedWorkflowOutcome
  | FaultedWorkflowOutcome
  | CancelledWorkflowOutcome
  | StartedOutcome
  | MissingWorkflowOutcome
  | ExpiredOutcome;

interface ElapsedTimerOutcome {
  readonly kind: "elapsed";
}

export type TimerOutcome = ElapsedTimerOutcome | ExpiredOutcome;

interface EmittedOutcome {
  readonly kind: "emitted";
}

export type EmitOutcome = EmittedOutcome | Failure;

interface EventListenOutcome {
  readonly kind: "event";
  readonly event: CloudEvent;
}

export type ListenOutcome = EventListenOutcome | ExpiredOutcome;

interface FetchedResourceOutcome {
  readonly kind: "fetched";
  readonly document: JsonValue;
}

export type ResourceOutcome = FetchedResourceOutcome | Failure;

interface OutcomesByKind {
  readonly http: HttpOutcome;
  readonly openapi: HttpOutcome;
  readonly grpc: GrpcOutcome;
  readonly asyncapi: AsyncApiOutcome;
  readonly a2a: RpcOutcome;
  readonly mcp: RpcOutcome;
  readonly process: ProcessOutcome;
  readonly workflow: WorkflowOutcome;
  readonly timer: TimerOutcome;
  readonly emit: EmitOutcome;
  readonly listen: ListenOutcome;
  readonly resource: ResourceOutcome;
}

type OutcomeOf<Kind extends EffectKind> = OutcomesByKind[Kind];

export type EffectOutcome = OutcomeOf<EffectKind>;
