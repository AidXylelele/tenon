import type {
  AuthenticationScheme,
  Failure,
  HttpRequest,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";
import type ipaddr from "ipaddr.js";
import type { z } from "zod";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PATH,
} from "./openapi-document.schema.js";

export interface OutboundRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Headers;
  readonly body: string | null;
  readonly redirect: NonNullable<RequestInit["redirect"]>;
}

export interface Signed {
  readonly response: Response;
  readonly authorization: RevealedAuthorization | null;
}

export type ResponseOptions = Pick<
  HttpRequest,
  "output" | "revealAuthorization"
>;

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

export type EndpointFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type IpAddress = ipaddr.IPv4 | ipaddr.IPv6;

export type AddressRange = [IpAddress, number];

export type AddressRanges = Parameters<typeof ipaddr.subnetMatch>[1];

export type OpenApiDocument = z.infer<typeof OPENAPI_DOCUMENT>;

export type OpenApiPath = z.infer<typeof OPENAPI_PATH>;

export type OpenApiOperation = z.infer<typeof OPENAPI_OPERATION>;

export interface LocatedOperation {
  readonly item: OpenApiPath;
  readonly operation: OpenApiOperation;
}

export type OperationRequest =
  | { readonly kind: "operation"; readonly request: OutboundRequest }
  | Extract<Failure, { readonly kind: "misconfigured" }>;
