import type { OAuth2Credentials } from "../../interface-adapters/auth/interfaces.js";

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

export interface TokenEndpoint {
  readonly issuer: string;
  readonly located: boolean;
  grant(type: string, parameters: URLSearchParams): Promise<string>;
}
