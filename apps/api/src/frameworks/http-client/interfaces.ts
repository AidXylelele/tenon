import type {
  Authentication,
  Failure,
  HttpRequest,
  RevealedAuthorization,
} from "interpreter";
import type { z } from "zod";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PARAMETER,
  OPENAPI_PATH,
  OPENAPI_SERVER,
} from "./openapi-document.schema.js";

export interface OutboundRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Readonly<Record<string, string>>;
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

export type Credentials = Exclude<Authentication, { readonly kind: "secret" }>;

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
  | { readonly kind: "header"; readonly header: RevealedAuthorization }
  | { readonly kind: "digest"; readonly credentials: PasswordCredentials };

export type Authorized = Authorization | UnusableSecret;

export interface DigestChallenge {
  readonly parameters: ReadonlyMap<string, string>;
  readonly algorithm: string;
  readonly hashName: string;
  readonly session: boolean;
}

export type FetchedText =
  { readonly kind: "text"; readonly text: string } | Failure;

export type EndpointFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type OpenApiDocument = z.infer<typeof OPENAPI_DOCUMENT>;

export type OpenApiPath = z.infer<typeof OPENAPI_PATH>;

export type OpenApiOperation = z.infer<typeof OPENAPI_OPERATION>;

export type OpenApiParameter = z.infer<typeof OPENAPI_PARAMETER>;

export type OpenApiServer = z.infer<typeof OPENAPI_SERVER>;

export interface LocatedOperation {
  readonly path: string;
  readonly method: string;
  readonly item: OpenApiPath;
  readonly operation: OpenApiOperation;
}

export interface Operation {
  readonly swagger: boolean;
  readonly path: string;
  readonly method: string;
  readonly base: string;
  readonly parameters: readonly OperationParameter[];
  readonly media: string;
  readonly body: OperationBody | null;
}

export interface OperationParameter {
  readonly name: string;
  readonly location: string;
  readonly required: boolean;
  readonly separator: string;
  readonly exploded: boolean;
}

export interface OperationBody {
  readonly media: string;
  readonly required: boolean;
}

export interface OperationContent {
  readonly media: string;
  readonly body: string;
}

export type OperationRequest =
  | { readonly kind: "operation"; readonly request: OutboundRequest }
  | Extract<Failure, { readonly kind: "misconfigured" }>;
