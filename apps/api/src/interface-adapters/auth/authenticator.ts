import { Injectable } from "@nestjs/common";
import {
  type Authentication,
  createSecretPolicies,
  type HostProfile,
  type JsonObject,
  type ResolvedAuthentication,
  type RevealedAuthorization,
  type SecretPolicies,
} from "interpreter";
import {
  AccessTokens,
  type Authorized,
  type Credentials,
  type PasswordCredentials,
  type UnusableSecret,
} from "./interfaces.js";

@Injectable()
export class Authenticator {
  private readonly policies: SecretPolicies;

  constructor(
    private readonly tokens: AccessTokens,
    private readonly profile: HostProfile,
  ) {
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
      case "oauth2":
      case "oidc": {
        const token = await this.tokens.accessTokenFor(credentials, signal);
        return this.#header("Bearer", token);
      }
    }
  }

  credentialsOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): Credentials | UnusableSecret | null {
    const resolved = this.#resolvedOf(authentication, secrets);
    const performable = this.#performable(resolved);

    if (!performable)
      throw new Error(
        "The host does not perform 'authentication.digest'; its profile refuses it at publish",
      );

    return resolved;
  }

  headerValueOf(authorization: RevealedAuthorization): string {
    return `${authorization.scheme} ${authorization.parameter}`;
  }

  #resolvedOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): ResolvedAuthentication | UnusableSecret | null {
    if (authentication === null) return null;

    if (authentication.kind !== "secret") return authentication;

    const name = authentication.secret;
    const given = Object.hasOwn(secrets, name);

    if (!given)
      return {
        kind: "forbidden",
        detail: "The secret is not among the secrets of this run",
      };

    const scheme = authentication.scheme;
    const value = secrets[name] ?? null;
    const held = this.policies.authenticationOf(scheme, value, this.profile);

    if (held.kind === "refused")
      return {
        kind: "misconfigured",
        detail: `The secret's ${scheme} policy is refused: ${held.reason}`,
      };

    return held;
  }

  #performable(
    resolved: ResolvedAuthentication | UnusableSecret | null,
  ): resolved is Credentials | UnusableSecret | null {
    return resolved?.kind !== "digest";
  }

  #header(scheme: string, parameter: string): Authorized {
    return { kind: "header", header: { scheme, parameter } };
  }

  #pairOf(credentials: PasswordCredentials): string {
    const pair = `${credentials.username}:${credentials.password}`;
    return Buffer.from(pair, "utf8").toString("base64");
  }
}
