import type { AuthenticationScheme } from "../../api/index.js";
import type {
  OAuth2ClientAuthentication,
  OAuth2Grant,
  OAuth2RequestEncoding,
} from "../../standard/index.js";
import type { Reference, TextTemplate, ValueTemplate } from "./data.js";

export interface Endpoint {
  readonly pointer: string;
  readonly uri: TextTemplate;
  readonly authentication: AuthenticationPolicy | Reference | null;
}

export interface ExternalResource {
  readonly kind: "external";
  readonly pointer: string;
  readonly name: string | null;
  readonly endpoint: Endpoint;
}

export interface BasicAuthentication {
  readonly kind: "basic";
  readonly pointer: string;
  readonly username: TextTemplate;
  readonly password: TextTemplate;
}

export interface BearerAuthentication {
  readonly kind: "bearer";
  readonly pointer: string;
  readonly token: TextTemplate;
}

export interface DigestAuthentication {
  readonly kind: "digest";
  readonly pointer: string;
  readonly username: TextTemplate;
  readonly password: TextTemplate;
}

export interface OAuth2Properties {
  readonly pointer: string;
  readonly authority: string;
  readonly grant: OAuth2Grant;
  readonly client: OAuth2Client;
  readonly encoding: OAuth2RequestEncoding;
  readonly issuers: ValueTemplate | null;
  readonly scopes: ValueTemplate | null;
  readonly audiences: ValueTemplate | null;
  readonly username: TextTemplate | null;
  readonly password: TextTemplate | null;
  readonly subject: OAuth2Token | null;
  readonly actor: OAuth2Token | null;
}

export interface OAuth2Authentication extends OAuth2Properties {
  readonly kind: "oauth2";
  readonly endpoints: OAuth2Endpoints;
}

export interface OidcAuthentication extends OAuth2Properties {
  readonly kind: "oidc";
}

export interface OAuth2Endpoints {
  readonly pointer: string;
  readonly token: string;
  readonly revocation: string;
  readonly introspection: string;
}

export interface OAuth2Client {
  readonly pointer: string;
  readonly id: TextTemplate | null;
  readonly secret: TextTemplate | null;
  readonly assertion: TextTemplate | null;
  readonly authentication: OAuth2ClientAuthentication;
}

export interface OAuth2Token {
  readonly pointer: string;
  readonly token: TextTemplate;
  readonly type: TextTemplate;
}

interface SecretAuthentication {
  readonly kind: "secret";
  readonly pointer: string;
  readonly scheme: AuthenticationScheme;
  readonly secret: Reference;
}

interface AuthenticationSchemes {
  readonly basic: BasicAuthentication;
  readonly bearer: BearerAuthentication;
  readonly digest: DigestAuthentication;
  readonly oauth2: OAuth2Authentication;
  readonly oidc: OidcAuthentication;
}

export type AuthenticationPolicy =
  AuthenticationSchemes[AuthenticationScheme] | SecretAuthentication;
