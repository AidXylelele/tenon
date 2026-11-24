import type { MethodDefinition } from "@grpc/proto-loader";
import type {
  AsyncApiOutcome,
  Endpoint,
  Failure,
  JsonObject,
  JsonValue,
  McpRequest,
  ProcessOutcome,
} from "interpreter";
import type { Message, Root } from "protobufjs";
import type { z } from "zod";
import type { BrokerServer } from "../../../frameworks/asyncapi/interfaces.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type { BasicCredentials } from "../../auth/interfaces.js";
import type { OutboundRequest } from "../../http/interfaces.js";
import type { StepCall } from "../interfaces.js";
import type { AGENT_CARD } from "./agent-card.schema.js";
import type {
  AMQP_CHANNEL,
  MQTT_OPERATION,
} from "./asyncapi-bindings.schema.js";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PATH,
} from "./openapi-document.schema.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export type Misconfigured = Extract<
  Failure,
  { readonly kind: "misconfigured" }
>;

export interface PreparedCall {
  readonly kind: "call";
  readonly method: MethodDefinition<object, object>;
  readonly argument: Message;
}

export type ParsedProto =
  { readonly kind: "root"; readonly root: Root } | Misconfigured;

export interface SandboxLimitsProps {
  readonly time: Temporal.Duration;
  readonly memoryBytes: number;
  readonly processes: number;
  readonly outputBytes: number;
}

export interface ScriptLanguage {
  readonly interpreter: string;
  declares(name: string): boolean;
  declarationOf(name: string, value: JsonValue): string;
}

export interface SandboxFile {
  readonly content?: string;
  readonly name?: string;
  readonly max?: number;
}

export interface SandboxCommand {
  readonly args: readonly string[];
  readonly env: readonly string[];
  readonly files: readonly SandboxFile[];
  readonly cpuLimit: number;
  readonly clockLimit: number;
  readonly memoryLimit: number;
  readonly procLimit: number;
  readonly copyIn: Readonly<Record<string, SandboxFile>>;
}

export type BuiltCommand =
  | { readonly kind: "command"; readonly command: SandboxCommand }
  | ProcessOutcome;

export type AgentCardProperties = z.infer<typeof AGENT_CARD>;

export type Agent =
  { readonly kind: "agent"; readonly endpoint: Endpoint } | Failure;

export interface AgentOffer {
  readonly url: string;
  readonly binding: string;
  readonly version: string;
}

export type EndpointFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type HttpTransport = Extract<
  McpRequest["transport"],
  { readonly kind: "http" }
>;

export type HttpMcpRequest = McpRequest & {
  readonly transport: HttpTransport;
};

export type McpMethod = McpRequest["method"];

export interface McpSession {
  readonly endpoint: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly client: McpRequest["client"];
  readonly protocolVersion: string;
  readonly fetchOf: (signal: AbortSignal) => EndpointFetch;
}

export interface McpCall {
  readonly method: McpMethod;
  readonly params: JsonObject | null;
  readonly remaining: number | null;
}

export type McpAnswer =
  | { readonly kind: "answered"; readonly result: unknown }
  | { readonly kind: "outdated" };

export abstract class McpConnection {
  abstract speaks(protocolVersion: string): boolean;
  abstract request(
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<McpAnswer>;
}

export type OpenApiDocument = z.infer<typeof OPENAPI_DOCUMENT>;

type OpenApiPath = z.infer<typeof OPENAPI_PATH>;

type OpenApiOperation = z.infer<typeof OPENAPI_OPERATION>;

export interface LocatedOperation {
  readonly item: OpenApiPath;
  readonly operation: OpenApiOperation;
}

export type OperationRequest =
  | { readonly kind: "operation"; readonly request: OutboundRequest }
  | Extract<Failure, { readonly kind: "misconfigured" }>;

export interface AsyncApiServer extends BrokerServer {
  readonly protocol: string;
  readonly protocolVersion: string | null;
}

interface BrokerBindings {
  readonly channel: Readonly<Record<string, unknown>>;
  readonly operation: Readonly<Record<string, unknown>>;
}

export interface BrokerTarget {
  readonly kind: "target";
  readonly server: AsyncApiServer;
  readonly address: string;
  readonly contentType: string;
  readonly bindings: BrokerBindings;
}

export type Targeted =
  BrokerTarget | Extract<Failure, { readonly kind: "misconfigured" }>;

export type Expired = Extract<Failure, { readonly kind: "expired" }>;

export interface BrokerMessage {
  readonly body: Buffer;
  readonly contentType: string;
  readonly headers: JsonObject;
  readonly idempotencyKey: string;
  readonly login: BasicCredentials | null;
}

export interface ReceivedBrokerMessage {
  readonly body: Buffer;
  readonly contentType: string | null;
  readonly headers: JsonObject;
  readonly correlationId: string | null;
}

export interface BrokerInbox {
  readonly subscriber: string;
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  deliver(message: ReceivedBrokerMessage): Promise<void>;
  lost(): void;
}

export interface BrokerGateway {
  publish(
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome>;
  subscribe(
    target: BrokerTarget,
    login: BasicCredentials | null,
    inbox: BrokerInbox,
  ): Promise<Subscribed>;
}

export type AmqpBinding = z.infer<typeof AMQP_CHANNEL>;

export type MqttBinding = z.infer<typeof MQTT_OPERATION>;
