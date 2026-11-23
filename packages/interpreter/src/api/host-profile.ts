import type { EffectKind } from "./effects.js";

export type AuthenticationScheme =
  "basic" | "bearer" | "digest" | "oauth2" | "oidc";

export type OAuth2Grant =
  | "authorization_code"
  | "client_credentials"
  | "password"
  | "refresh_token"
  | "urn:ietf:params:oauth:grant-type:token-exchange";

export interface HostProfile {
  readonly effects: readonly EffectKind[];
  readonly authentications: readonly AuthenticationScheme[];
  readonly processes: readonly ("container" | "script" | "shell")[];
  readonly scriptLanguages: readonly ("js" | "python")[];
  readonly asyncApiProtocols: readonly string[];
  readonly mcpTransports: readonly ("http" | "stdio")[];
  readonly mcpTransportOptions?: readonly string[];
  readonly schedules: readonly ("every" | "cron" | "after" | "on")[];
  readonly triggers?: "one" | "many";
  readonly grants: readonly OAuth2Grant[];
  readonly secrets: readonly string[];
}

export type Imports = Readonly<Record<string, string>>;

export interface InterpreterOptions {
  readonly legacyEventTypes?: boolean;
}

export interface AnalysisOptions {
  readonly profile: HostProfile;
  readonly imports: Imports;
}
