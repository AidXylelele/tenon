import { Injectable } from "@nestjs/common";
import { HttpClientError } from "@nestjs/http-client";
import { decodeJwt, type JWTPayload } from "jose";
import { ClientError, ResponseBodyError } from "openid-client";
import { RefusalCode } from "./enums.js";
import {
  AuthorizationServer,
  type ClientAuthentication,
  type OAuth2Credentials,
  type TokenClient,
  type TokenEndpoint,
} from "./interfaces.js";

@Injectable()
export class AccessTokens {
  constructor(private readonly server: AuthorizationServer) {}

  async accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string> {
    const client = this.#clientOf(credentials);
    const endpoint = await this.#endpointOf(client, signal);
    this.#accept(endpoint, credentials);
    const token = await this.#granted(endpoint, credentials);
    const issued = this.#issuedByAccepted(token, credentials);

    if (!issued)
      throw this.#refused(
        "The token was not issued by one of the accepted issuers",
      );

    return token;
  }

  async #endpointOf(
    client: TokenClient,
    signal: AbortSignal,
  ): Promise<TokenEndpoint> {
    try {
      return await this.server.endpointOf(client, signal);
    } catch (error) {
      throw this.#refusalOf(
        error,
        "The OpenID provider configuration cannot be read",
      );
    }
  }

  #accept(endpoint: TokenEndpoint, credentials: OAuth2Credentials): void {
    if (credentials.kind !== "oidc") return;

    if (!endpoint.located)
      throw this.#refused(
        "The OpenID provider configuration names no token endpoint",
      );

    const issuers = credentials.issuers;
    const accepted = issuers.length === 0 || issuers.includes(endpoint.issuer);

    if (!accepted)
      throw this.#refused(
        "The OpenID provider is not one of the accepted issuers",
      );
  }

  async #granted(
    endpoint: TokenEndpoint,
    credentials: OAuth2Credentials,
  ): Promise<string> {
    const parameters = this.#parametersOf(credentials);

    try {
      return await endpoint.grant(credentials.grant, parameters);
    } catch (error) {
      throw this.#refusalOf(
        error,
        "The authorization server refused to issue a token",
      );
    }
  }

  #clientOf(credentials: OAuth2Credentials): TokenClient {
    const id = credentials.client.id;

    if (id === null) throw this.#refused("The OAuth2 client needs its id");

    const authentication = this.#clientAuthenticationOf(credentials);
    const tokenEndpoint = this.#tokenEndpointOf(credentials);
    return {
      authority: credentials.authority,
      tokenEndpoint,
      id,
      authentication,
      encoding: credentials.encoding,
    };
  }

  #clientAuthenticationOf(
    credentials: OAuth2Credentials,
  ): ClientAuthentication {
    const client = credentials.client;

    switch (client.authentication) {
      case "client_secret_basic":
      case "client_secret_post": {
        const secret = this.#secretOf(credentials);
        return { kind: client.authentication, secret };
      }
      case "client_secret_jwt": {
        if (client.assertion !== null)
          return { kind: "assertion", assertion: client.assertion };

        const secret = this.#secretOf(credentials);
        return { kind: "client_secret_jwt", secret };
      }
      case "private_key_jwt":
        if (client.assertion === null)
          throw this.#refused("private_key_jwt needs the client assertion");

        return { kind: "assertion", assertion: client.assertion };
      case "none":
        return { kind: "none" };
    }
  }

  #secretOf(credentials: OAuth2Credentials): string {
    const client = credentials.client;

    if (client.secret === null)
      throw this.#refused(`${client.authentication} needs the client secret`);

    return client.secret;
  }

  #tokenEndpointOf(credentials: OAuth2Credentials): string | null {
    if (credentials.kind === "oidc") return null;

    const path = credentials.endpoints?.token ?? "/oauth2/token";
    const absolute = URL.canParse(path);

    if (absolute) return path;

    const authority = credentials.authority.replace(/\/+$/, "");
    const relative = path.replace(/^\/+/, "");
    return `${authority}/${relative}`;
  }

  #parametersOf(credentials: OAuth2Credentials): URLSearchParams {
    const parameters = new URLSearchParams();

    const scope = credentials.scopes.join(" ");

    if (scope !== "") parameters.set("scope", scope);

    for (const audience of credentials.audiences)
      parameters.append("audience", audience);

    if (credentials.subject !== null) {
      parameters.set("subject_token", credentials.subject.token);
      parameters.set("subject_token_type", credentials.subject.type);
    }

    if (credentials.actor !== null) {
      parameters.set("actor_token", credentials.actor.token);
      parameters.set("actor_token_type", credentials.actor.type);
    }

    return parameters;
  }

  #issuedByAccepted(token: string, credentials: OAuth2Credentials): boolean {
    const unchecked =
      credentials.kind !== "oauth2" || credentials.issuers.length === 0;

    if (unchecked) return true;

    const claims = this.#claimsOf(token);

    if (claims === null) return true;

    const issuer = claims.iss;

    if (issuer === undefined) return false;

    return credentials.issuers.includes(issuer);
  }

  #claimsOf(token: string): JWTPayload | null {
    try {
      return decodeJwt(token);
    } catch {
      return null;
    }
  }

  #refusalOf(error: unknown, detail: string): unknown {
    const cause: unknown = error instanceof ClientError ? error.cause : null;
    const transported = this.#transported(cause);

    if (transported) return cause;

    const plaintext =
      error instanceof ClientError &&
      error.code === "OAUTH_HTTP_REQUEST_FORBIDDEN";

    if (plaintext)
      return this.#refused(
        "The authorization server is not reached over HTTPS, which OAuth 2.0 requires",
      );

    const refusing =
      error instanceof ResponseBodyError || error instanceof ClientError;
    return refusing ? this.#refused(detail) : error;
  }

  #transported(cause: unknown): boolean {
    if (cause instanceof HttpClientError) return true;

    const code: unknown =
      cause instanceof Error ? Reflect.get(cause, "code") : undefined;
    return code === RefusalCode.ResponseSize;
  }

  #refused(message: string): Error {
    const error = new Error(message);
    return Object.assign(error, { code: RefusalCode.Token });
  }
}
