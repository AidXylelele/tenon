import type { CloudEvent } from "./events.js";
import type { AuthenticationScheme, OAuth2Grant } from "./host-profile.js";
import type { JsonObject, JsonValue } from "./json.js";

interface CredentialsAuthentication {
  readonly kind: "basic" | "digest";
  readonly username: string;
  readonly password: string;
}

interface BearerAuthentication {
  readonly kind: "bearer";
  readonly token: string;
}

interface OAuth2Authentication extends OAuth2Properties {
  readonly kind: "oauth2" | "oidc";
}

interface SecretAuthentication {
  readonly kind: "secret";
  readonly scheme: AuthenticationScheme;
  readonly secret: string;
}

export type ResolvedAuthentication =
  CredentialsAuthentication | BearerAuthentication | OAuth2Authentication;

export type Authentication = ResolvedAuthentication | SecretAuthentication;

interface OAuth2Endpoints {
  readonly token: string;
  readonly revocation: string;
  readonly introspection: string;
}

interface OAuth2Token {
  readonly token: string;
  readonly type: string;
}

interface OAuth2Client {
  readonly id: string | null;
  readonly secret: string | null;
  readonly assertion: string | null;
  readonly authentication:
    | "client_secret_basic"
    | "client_secret_post"
    | "client_secret_jwt"
    | "private_key_jwt"
    | "none";
}

export interface OAuth2Properties {
  readonly authority: string;
  readonly endpoints: OAuth2Endpoints | null;
  readonly grant: OAuth2Grant;
  readonly client: OAuth2Client;
  readonly encoding: "application/x-www-form-urlencoded" | "application/json";
  readonly issuers: readonly string[];
  readonly scopes: readonly string[];
  readonly audiences: readonly string[];
  readonly username: string | null;
  readonly password: string | null;
  readonly subject: OAuth2Token | null;
  readonly actor: OAuth2Token | null;
}

export interface Endpoint {
  readonly uri: string;
  readonly authentication: Authentication | null;
}

export interface Resource {
  readonly name: string | null;
  readonly endpoint: Endpoint;
}

export interface HttpRequest {
  readonly kind: "http";
  readonly method: string;
  readonly endpoint: Endpoint;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: JsonValue;
  readonly output: "raw" | "content" | "response";
  readonly revealAuthorization: boolean;
}

export interface OpenApiRequest {
  readonly kind: "openapi";
  readonly document: Resource;
  readonly operationId: string;
  readonly parameters: JsonObject;
  readonly authentication: Authentication | null;
  readonly output: "raw" | "content" | "response";
  readonly revealAuthorization: boolean;
}

interface GrpcService {
  readonly name: string;
  readonly host: string;
  readonly port: number | null;
}

export interface GrpcRequest {
  readonly kind: "grpc";
  readonly proto: Resource;
  readonly method: string;
  readonly arguments: JsonObject;
  readonly service: GrpcService;
  readonly authentication: Authentication | null;
}

interface AsyncApiServer {
  readonly name: string;
  readonly variables: JsonObject;
}

interface PublishExchange {
  readonly kind: "publish";
  readonly message: AsyncApiMessage;
}

interface ReceiveExchange {
  readonly kind: "receive";
  readonly subscription: string;
  readonly position: number;
  readonly closesAt: number | null;
}

export interface AsyncApiRequest {
  readonly kind: "asyncapi";
  readonly document: Resource;
  readonly authentication: Authentication | null;
  readonly operation: string | null;
  readonly channel: string | null;
  readonly server: AsyncApiServer | null;
  readonly protocol: string | null;
  readonly exchange: PublishExchange | ReceiveExchange;
}

export interface AsyncApiMessage {
  readonly payload: JsonValue;
  readonly headers: JsonObject;
}

interface CardAgent {
  readonly kind: "card";
  readonly card: Resource;
}

interface ServerAgent {
  readonly kind: "server";
  readonly endpoint: Endpoint;
}

export interface A2aRequest {
  readonly kind: "a2a";
  readonly method: A2aMethod;
  readonly agent: CardAgent | ServerAgent;
  readonly parameters: JsonValue;
}

type A2aMethod =
  | "message/send"
  | "message/stream"
  | "tasks/get"
  | "tasks/list"
  | "tasks/cancel"
  | "tasks/resubscribe"
  | "tasks/pushNotificationConfig/set"
  | "tasks/pushNotificationConfig/get"
  | "tasks/pushNotificationConfig/list"
  | "tasks/pushNotificationConfig/delete"
  | "agent/getAuthenticatedExtendedCard";

interface HttpTransport {
  readonly kind: "http";
  readonly endpoint: Endpoint;
  readonly headers: Readonly<Record<string, string>>;
}

interface StdioTransport {
  readonly kind: "stdio";
  readonly command: string;
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}

interface McpClient {
  readonly name: string;
  readonly version: string;
}

export interface McpRequest {
  readonly kind: "mcp";
  readonly protocolVersion: string;
  readonly method:
    | "tools/list"
    | "tools/call"
    | "prompts/list"
    | "prompts/get"
    | "resources/list"
    | "resources/read"
    | "resources/templates/list";
  readonly parameters: JsonValue;
  readonly transport: HttpTransport | StdioTransport;
  readonly options: Readonly<Record<string, string>>;
  readonly client: McpClient | null;
}

export interface ProcessRequest {
  readonly kind: "process";
  readonly process: Container | Script | Shell;
  readonly await: boolean;
}

interface ContainerLifetime {
  readonly cleanup: "always" | "never" | "eventually";
  readonly after: number | null;
}

export interface Container {
  readonly kind: "container";
  readonly image: string;
  readonly command: string | null;
  readonly stdin: string | null;
  readonly arguments: readonly string[];
  readonly name: string | null;
  readonly ports: JsonObject;
  readonly volumes: JsonObject;
  readonly environment: Readonly<Record<string, string>>;
  readonly lifetime: ContainerLifetime;
  readonly pullPolicy: "ifNotPresent" | "always" | "never";
}

export interface Script {
  readonly kind: "script";
  readonly language: "js" | "python";
  readonly code: string | null;
  readonly source: Resource | null;
  readonly stdin: string | null;
  readonly arguments: JsonObject;
  readonly environment: Readonly<Record<string, string>>;
}

export interface Shell {
  readonly kind: "shell";
  readonly command: string;
  readonly stdin: string | null;
  readonly arguments: readonly string[];
  readonly directory: string | null;
  readonly environment: Readonly<Record<string, string>>;
}

export interface WorkflowRequest {
  readonly kind: "workflow";
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly input: JsonValue;
  readonly await: boolean;
}

export interface TimerRequest {
  readonly kind: "timer";
  readonly until: number;
}

export interface EmitRequest {
  readonly kind: "emit";
  readonly event: CloudEvent;
}

interface OpenFilter {
  readonly level: number;
  readonly filter: number;
}

export interface ListenRequest {
  readonly kind: "listen";
  readonly stream: string;
  readonly subscription: string;
  readonly position: number;
  readonly open: readonly OpenFilter[];
}

export interface ResourceRequest {
  readonly kind: "resource";
  readonly resource: Resource;
}

export type EffectRequest =
  | HttpRequest
  | OpenApiRequest
  | GrpcRequest
  | AsyncApiRequest
  | A2aRequest
  | McpRequest
  | ProcessRequest
  | WorkflowRequest
  | TimerRequest
  | EmitRequest
  | ListenRequest
  | ResourceRequest;
