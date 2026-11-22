import type { AuthenticationScheme } from "../../api/index.js";
import type {
  A2aMethod,
  AsyncApiProtocol,
  HttpOutputMode,
  McpMethod,
  OAuth2ClientAuthentication,
  OAuth2Grant,
  OAuth2RequestEncoding,
  PullPolicy,
  ReturnMode,
  ScriptLanguage,
} from "../../standard/index.js";
import type {
  DurationTerm,
  OptionalPart,
  Template,
  UriTemplateTerm,
  UriTerm,
} from "./values.js";

export interface NoAuthentication {
  readonly kind: "none";
}

export interface BasicTemplate {
  readonly kind: "basic";
  readonly username: Template;
  readonly password: Template;
}

export interface BearerTemplate {
  readonly kind: "bearer";
  readonly token: Template;
}

export interface DigestTemplate {
  readonly kind: "digest";
  readonly username: Template;
  readonly password: Template;
}

export interface OAuth2ClientTemplate {
  readonly id: OptionalPart;
  readonly secret: OptionalPart;
  readonly assertion: OptionalPart;
  readonly authentication: OAuth2ClientAuthentication;
}

export interface NoToken {
  readonly kind: "none";
}

export interface GivenToken {
  readonly kind: "given";
  readonly token: Template;
  readonly type: Template;
}

export type OAuth2TokenTemplate = NoToken | GivenToken;

export interface OAuth2Endpoints {
  readonly token: UriTemplateTerm;
  readonly revocation: UriTemplateTerm;
  readonly introspection: UriTemplateTerm;
}

export interface OAuth2TemplateProperties {
  readonly authority: UriTemplateTerm;
  readonly grant: OAuth2Grant;
  readonly client: OAuth2ClientTemplate;
  readonly encoding: OAuth2RequestEncoding;
  readonly issuers: Template;
  readonly scopes: Template;
  readonly audiences: Template;
  readonly username: OptionalPart;
  readonly password: OptionalPart;
  readonly subject: OAuth2TokenTemplate;
  readonly actor: OAuth2TokenTemplate;
}

export interface OAuth2Template extends OAuth2TemplateProperties {
  readonly kind: "oauth2";
  readonly endpoints: OAuth2Endpoints;
}

export interface OidcTemplate extends OAuth2TemplateProperties {
  readonly kind: "oidc";
}

export interface SecretTemplate {
  readonly kind: "secret";
  readonly scheme: AuthenticationScheme;
  readonly secret: string;
}

export type AuthenticationTemplate =
  | NoAuthentication
  | BasicTemplate
  | BearerTemplate
  | DigestTemplate
  | OAuth2Template
  | OidcTemplate
  | SecretTemplate;

export interface EndpointTemplate {
  readonly uri: UriTerm;
  readonly authentication: AuthenticationTemplate;
}

export interface ResourceTemplate {
  readonly kind: "resource";
  readonly name: OptionalPart;
  readonly endpoint: EndpointTemplate;
}

export interface HttpTemplate {
  readonly kind: "http";
  readonly method: Template;
  readonly endpoint: EndpointTemplate;
  readonly headers: Template;
  readonly body: Template;
  readonly query: Template;
  readonly output: HttpOutputMode;
}

export interface OpenApiTemplate {
  readonly kind: "openapi";
  readonly document: ResourceTemplate;
  readonly operationId: string;
  readonly parameters: Template;
  readonly authentication: AuthenticationTemplate;
  readonly output: HttpOutputMode;
}

export interface GrpcService {
  readonly name: string;
  readonly host: string;
  readonly port: OptionalPart;
  readonly authentication: AuthenticationTemplate;
}

export interface GrpcTemplate {
  readonly kind: "grpc";
  readonly proto: ResourceTemplate;
  readonly service: GrpcService;
  readonly method: string;
  readonly arguments: Template;
}

export interface ChannelTarget {
  readonly kind: "channel";
  readonly channel: string;
}

export interface OperationTarget {
  readonly kind: "operation";
  readonly operation: string;
}

export type AsyncApiTarget = ChannelTarget | OperationTarget;

export interface DefaultServer {
  readonly kind: "default";
}

export interface NamedServer {
  readonly kind: "named";
  readonly name: string;
  readonly variables: Template;
}

export type AsyncApiServerTemplate = DefaultServer | NamedServer;

export interface DefaultProtocol {
  readonly kind: "default";
}

export interface NamedProtocol {
  readonly kind: "named";
  readonly protocol: AsyncApiProtocol;
}

export type AsyncApiProtocolChoice = DefaultProtocol | NamedProtocol;

export interface AsyncApiRequestTemplate {
  readonly document: ResourceTemplate;
  readonly target: AsyncApiTarget;
  readonly server: AsyncApiServerTemplate;
  readonly protocol: AsyncApiProtocolChoice;
  readonly authentication: AuthenticationTemplate;
}

export interface AsyncApiPublishTemplate extends AsyncApiRequestTemplate {
  readonly kind: "asyncapi";
  readonly payload: Template;
  readonly headers: Template;
}

export interface AgentCardTemplate {
  readonly kind: "agentCard";
  readonly resource: ResourceTemplate;
}

export interface AgentServerTemplate {
  readonly kind: "server";
  readonly endpoint: EndpointTemplate;
}

export interface A2aTemplate {
  readonly kind: "a2a";
  readonly method: A2aMethod;
  readonly agent: AgentCardTemplate | AgentServerTemplate;
  readonly parameters: Template;
}

export interface McpHttpTransport {
  readonly kind: "http";
  readonly endpoint: EndpointTemplate;
  readonly headers: Template;
  readonly options: Readonly<Record<string, string>>;
}

export interface McpStdioTransport {
  readonly kind: "stdio";
  readonly command: Template;
  readonly arguments: Template;
  readonly environment: Template;
  readonly options: Readonly<Record<string, string>>;
}

export interface AnonymousClient {
  readonly kind: "anonymous";
}

export interface NamedClient {
  readonly kind: "named";
  readonly name: string;
  readonly version: string;
}

export interface McpTemplate {
  readonly kind: "mcp";
  readonly protocolVersion: string;
  readonly method: McpMethod;
  readonly parameters: Template;
  readonly transport: McpHttpTransport | McpStdioTransport;
  readonly client: AnonymousClient | NamedClient;
}

export interface EvaluatedValue {
  readonly kind: "evaluated";
  readonly template: Template;
}

export interface DerivedIdValue {
  readonly kind: "derivedId";
}

export interface StepTimeValue {
  readonly kind: "stepTime";
}

export type AttributeValue =
  EvaluatedValue | UriTemplateTerm | DerivedIdValue | StepTimeValue;

export interface AttributeTemplate {
  readonly name: string;
  readonly value: AttributeValue;
}

export interface EmitTemplate {
  readonly kind: "emit";
  readonly attributes: readonly AttributeTemplate[];
}

export interface TimerTemplate {
  readonly kind: "timer";
  readonly duration: DurationTerm;
}

export interface AlwaysCleanup {
  readonly kind: "always";
}

export interface NeverCleanup {
  readonly kind: "never";
}

export interface EventualCleanup {
  readonly kind: "eventually";
  readonly after: DurationTerm;
}

export interface ContainerTemplate {
  readonly kind: "container";
  readonly image: Template;
  readonly name: OptionalPart;
  readonly command: OptionalPart;
  readonly ports: Template;
  readonly volumes: Template;
  readonly environment: Template;
  readonly stdin: OptionalPart;
  readonly arguments: Template;
  readonly lifetime: AlwaysCleanup | NeverCleanup | EventualCleanup;
  readonly pullPolicy: PullPolicy;
}

export interface InlineCodeTemplate {
  readonly kind: "inline";
  readonly code: string;
}

export interface ScriptTemplate {
  readonly kind: "script";
  readonly language: ScriptLanguage;
  readonly source: InlineCodeTemplate | ResourceTemplate;
  readonly stdin: OptionalPart;
  readonly arguments: Template;
  readonly environment: Template;
}

export interface ShellTemplate {
  readonly kind: "shell";
  readonly command: Template;
  readonly stdin: OptionalPart;
  readonly arguments: Template;
  readonly directory: OptionalPart;
  readonly environment: Template;
}

export interface ProcessTemplate {
  readonly kind: "process";
  readonly process: ContainerTemplate | ScriptTemplate | ShellTemplate;
  readonly await: boolean;
}

export interface WorkflowTemplate {
  readonly kind: "workflow";
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly input: Template;
  readonly await: boolean;
}

export type EffectTemplate =
  | HttpTemplate
  | OpenApiTemplate
  | GrpcTemplate
  | AsyncApiPublishTemplate
  | A2aTemplate
  | McpTemplate
  | EmitTemplate
  | TimerTemplate
  | ProcessTemplate
  | WorkflowTemplate
  | ResourceTemplate;

type InputEffect = Extract<
  EffectTemplate["kind"],
  "timer" | "process" | "workflow"
>;

export interface InputDecoder {
  readonly kind: "input";
  readonly awaits: InputEffect;
}

type SentEffect = Extract<EffectTemplate["kind"], "emit" | "asyncapi">;

export interface SentDecoder {
  readonly kind: "sent";
  readonly awaits: SentEffect;
}

export interface HttpDecoder {
  readonly kind: "http";
  readonly output: HttpOutputMode;
  readonly redirect: boolean;
}

export interface GrpcDecoder {
  readonly kind: "grpc";
}

export interface A2aDecoder {
  readonly kind: "a2a";
  readonly method: A2aMethod;
}

export interface McpDecoder {
  readonly kind: "mcp";
  readonly method: McpMethod;
}

export interface ProcessDecoder {
  readonly kind: "process";
  readonly return: ReturnMode;
}

export interface WorkflowDecoder {
  readonly kind: "workflow";
  readonly return: ReturnMode;
}

export type Decoder =
  | InputDecoder
  | SentDecoder
  | HttpDecoder
  | GrpcDecoder
  | A2aDecoder
  | McpDecoder
  | ProcessDecoder
  | WorkflowDecoder;
