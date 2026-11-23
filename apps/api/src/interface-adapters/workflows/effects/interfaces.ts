import type { ServiceError } from "@grpc/grpc-js";
import type { MethodDefinition } from "@grpc/proto-loader";
import type {
  AuthenticationScheme,
  Failure,
  GrpcOutcome,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";
import type { Message, Root } from "protobufjs";
import type { StepCall } from "../interfaces.js";

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

export abstract class AuthorizationServer {
  abstract accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string>;
}

export interface PreparedCall {
  readonly kind: "call";
  readonly method: MethodDefinition<object, object>;
  readonly argument: Message;
}

export type ParsedProto =
  { readonly kind: "root"; readonly root: Root } | Misconfigured;

export type GrpcReply =
  | Extract<GrpcOutcome, { readonly kind: "replied" | "status" }>
  | { readonly kind: "failed"; readonly error: ServiceError };
