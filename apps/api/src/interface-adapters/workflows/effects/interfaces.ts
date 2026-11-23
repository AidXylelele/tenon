import type {
  AuthenticationScheme,
  Endpoint,
  Failure,
  JsonObject,
  McpRequest,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";
import type { z } from "zod";
import type { StepCall } from "../interfaces.js";
import type { AGENT_CARD } from "./agent-card.schema.js";

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

export type Authorization =
  | { readonly kind: "anonymous" }
  | { readonly kind: "header"; readonly header: RevealedAuthorization };

export type Authorized = Authorization | UnusableSecret;

export abstract class AuthorizationServer {
  abstract accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string>;
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
