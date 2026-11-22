import { Injectable } from "@nestjs/common";
import {
  type Authentication,
  createSecretPolicies,
  type JsonObject,
  type SecretPolicies,
} from "interpreter";
import { HOST_PROFILE } from "../interpreter/host-profile.js";
import { AuthorizationServer } from "./authorization-server.js";
import type {
  Authorized,
  Credentials,
  PasswordCredentials,
  UnusableSecret,
} from "./interfaces.js";

@Injectable()
export class HttpAuthentication {
  private readonly policies: SecretPolicies;

  constructor(private readonly server: AuthorizationServer) {
    this.policies = createSecretPolicies();
  }

  async authorizationOf(
    authentication: Authentication | null,
    secrets: JsonObject,
    signal: AbortSignal,
  ): Promise<Authorized> {
    const credentials = this.credentialsOf(authentication, secrets);

    if (credentials === null) return { kind: "anonymous" };

    switch (credentials.kind) {
      case "forbidden":
      case "misconfigured":
        return credentials;
      case "bearer":
        return this.#header("Bearer", credentials.token);
      case "basic": {
        const pair = this.#pairOf(credentials);
        return this.#header("Basic", pair);
      }
      case "digest":
        return {
          kind: "misconfigured",
          detail: "The host does not answer HTTP Digest challenges",
        };
      case "oauth2":
      case "oidc": {
        const token = await this.server.accessTokenFor(credentials, signal);
        return this.#header("Bearer", token);
      }
    }
  }

  credentialsOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): Credentials | UnusableSecret | null {
    if (authentication === null) return null;

    if (authentication.kind !== "secret") return authentication;

    const name = authentication.secret;

    if (!Object.hasOwn(secrets, name))
      return {
        kind: "forbidden",
        detail: "The secret is not among the secrets of this run",
      };

    const scheme = authentication.scheme;
    const value = secrets[name] ?? null;
    const held = this.policies.authenticationOf(scheme, value, HOST_PROFILE);

    if (held.kind === "refused")
      return {
        kind: "misconfigured",
        detail: `The secret's ${scheme} policy is refused: ${held.reason}`,
      };

    return held;
  }

  #header(scheme: string, parameter: string): Authorized {
    return { kind: "header", header: { scheme, parameter } };
  }

  #pairOf(credentials: PasswordCredentials): string {
    const pair = `${credentials.username}:${credentials.password}`;
    return Buffer.from(pair, "utf8").toString("base64");
  }
}
