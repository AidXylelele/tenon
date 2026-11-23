import type { MethodDefinition } from "@grpc/proto-loader";
import type {
  AuthenticationScheme,
  Endpoint,
  Failure,
  HttpRequest,
  JsonObject,
  JsonValue,
  McpRequest,
  ProcessOutcome,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";
import type { Message, Root } from "protobufjs";
import type { z } from "zod";
import type { StepCall } from "../interfaces.js";
import type { AGENT_CARD } from "./agent-card.schema.js";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PATH,
} from "./openapi-document.schema.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export type Credentials = ResolvedAuthentication & {
  readonly kind: Exclude<AuthenticationScheme, "digest">;
};

export type OAuth2Credentials = Extract<
  Credentials,
  { readonly kind: "oauth2" | "oidc" }
>;

export interface PasswordCredentials {
  readonly username: string;
  readonly password: string;
}

export type UnusableSecret = Extract<
  Failure,
  { readonly kind: "forbidden" | "misconfigured" }
>;

export type Misconfigured = Extract<
  Failure,
  { readonly kind: "misconfigured" }
>;

export type Authorization =
  | { readonly kind: "anonymous" }
  | { readonly kind: "header"; readonly header: RevealedAuthorization };

export type Authorized = Authorization | UnusableSecret;

export type ClientAuthentication =
  | {
      readonly kind:
        "client_secret_basic" | "client_secret_post" | "client_secret_jwt";
      readonly secret: string;
    }
  | { readonly kind: "assertion"; readonly assertion: string }
  | { readonly kind: "none" };

export interface TokenClient {
  readonly authority: string;
  readonly tokenEndpoint: string | null;
  readonly id: string;
  readonly authentication: ClientAuthentication;
  readonly encoding: OAuth2Credentials["encoding"];
}

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

export interface TokenEndpoint {
  readonly issuer: string;
  readonly located: boolean;
  grant(type: string, parameters: URLSearchParams): Promise<string>;
}

export abstract class AuthorizationServer {
  abstract endpointOf(
    client: TokenClient,
    signal: AbortSignal,
  ): Promise<TokenEndpoint>;
}

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

export interface OutboundRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Headers;
  readonly body: string | null;
}

export interface Signed {
  readonly response: Response;
  readonly authorization: RevealedAuthorization | null;
}

export type ResponseOptions = Pick<
  HttpRequest,
  "output" | "revealAuthorization"
>;

export abstract class HttpConnection {
  abstract fetch(url: string | URL, init?: RequestInit): Promise<Response>;
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
