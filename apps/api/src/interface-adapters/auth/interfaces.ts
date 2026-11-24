import type {
  AuthenticationScheme,
  Failure,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";

export type Credentials = ResolvedAuthentication & {
  readonly kind: Exclude<AuthenticationScheme, "digest">;
};

export type OAuth2Credentials = Extract<
  Credentials,
  { readonly kind: "oauth2" | "oidc" }
>;

export type BasicCredentials = Extract<Credentials, { readonly kind: "basic" }>;

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

export abstract class AccessTokens {
  abstract accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string>;
}
