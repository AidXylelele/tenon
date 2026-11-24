import type {
  A2aMethod,
  AsyncApiProtocol,
  CallProtocol,
  HttpOutputMode,
  McpMethod,
  McpTransportKind,
} from "../../standard/index.js";
import type {
  Duration,
  Reference,
  TextTemplate,
  ValueTemplate,
} from "./data.js";
import type {
  AuthenticationPolicy,
  Endpoint,
  ExternalResource,
} from "./endpoints.js";
import type {
  AsyncApiMessageExchange,
  AsyncApiSubscriptionExchange,
} from "./events.js";

export interface AsyncApiCall {
  readonly kind: "asyncapi";
  readonly pointer: string;
  readonly document: ExternalResource;
  readonly target: AsyncApiChannelTarget | AsyncApiOperationTarget;
  readonly server: AsyncApiServer | null;
  readonly protocol: AsyncApiProtocol | null;
  readonly exchange: AsyncApiMessageExchange | AsyncApiSubscriptionExchange;
  readonly authentication: AuthenticationPolicy | Reference | null;
}

export interface AsyncApiChannelTarget {
  readonly kind: "channel";
  readonly pointer: string;
  readonly channel: string;
}

export interface AsyncApiOperationTarget {
  readonly kind: "operation";
  readonly pointer: string;
  readonly operation: string;
}

export interface AsyncApiServer {
  readonly pointer: string;
  readonly name: string;
  readonly variables: ValueTemplate | null;
}

export interface GrpcCall {
  readonly kind: "grpc";
  readonly pointer: string;
  readonly proto: ExternalResource;
  readonly service: GrpcService;
  readonly method: string;
  readonly arguments: ValueTemplate | null;
}

export interface GrpcService {
  readonly pointer: string;
  readonly name: string;
  readonly host: string;
  readonly port: number | null;
  readonly authentication: AuthenticationPolicy | Reference | null;
}

export interface HttpCall {
  readonly kind: "http";
  readonly pointer: string;
  readonly method: TextTemplate;
  readonly endpoint: Endpoint;
  readonly headers: ValueTemplate | null;
  readonly body: ValueTemplate | null;
  readonly query: ValueTemplate | null;
  readonly output: HttpOutputMode;
  readonly redirect: boolean;
}

export interface OpenApiCall {
  readonly kind: "openapi";
  readonly pointer: string;
  readonly document: ExternalResource;
  readonly operationId: string;
  readonly parameters: ValueTemplate | null;
  readonly authentication: AuthenticationPolicy | Reference | null;
  readonly output: HttpOutputMode;
  readonly redirect: boolean;
}

export interface A2aCall {
  readonly kind: "a2a";
  readonly pointer: string;
  readonly method: A2aMethod;
  readonly agent: A2aAgentCard | A2aServer;
  readonly parameters: ValueTemplate | null;
}

export interface A2aAgentCard {
  readonly kind: "agentCard";
  readonly pointer: string;
  readonly resource: ExternalResource;
}

export interface A2aServer {
  readonly kind: "server";
  readonly pointer: string;
  readonly endpoint: Endpoint;
}

export interface McpCall {
  readonly kind: "mcp";
  readonly pointer: string;
  readonly protocolVersion: string;
  readonly method: McpMethod;
  readonly parameters: ValueTemplate | null;
  readonly timeout: Duration | null;
  readonly transport: McpTransport;
  readonly client: McpClient | null;
}

export interface McpHttpTransport {
  readonly kind: "http";
  readonly pointer: string;
  readonly endpoint: Endpoint;
  readonly headers: ValueTemplate | null;
  readonly options: ReadonlyMap<string, string>;
}

export interface McpStdioTransport {
  readonly kind: "stdio";
  readonly pointer: string;
  readonly command: TextTemplate;
  readonly arguments: ValueTemplate | null;
  readonly environment: ValueTemplate | null;
  readonly options: ReadonlyMap<string, string>;
}

interface McpTransports {
  readonly http: McpHttpTransport;
  readonly stdio: McpStdioTransport;
}

export type McpTransport = McpTransports[McpTransportKind];

export interface McpClient {
  readonly pointer: string;
  readonly name: string;
  readonly version: string;
}

export interface FunctionCall {
  readonly kind: "function";
  readonly pointer: string;
  readonly function: Reference;
  readonly with: ValueTemplate | null;
}

interface ProtocolCalls {
  readonly asyncapi: AsyncApiCall;
  readonly grpc: GrpcCall;
  readonly http: HttpCall;
  readonly openapi: OpenApiCall;
  readonly a2a: A2aCall;
  readonly mcp: McpCall;
}

export type Call = ProtocolCalls[CallProtocol] | FunctionCall;
