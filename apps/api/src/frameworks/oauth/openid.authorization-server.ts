import { Injectable } from "@nestjs/common";
import {
  HttpClientError,
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { decodeJwt, type JWTPayload } from "jose";
import {
  type ClientAuth,
  ClientError,
  ClientSecretBasic,
  ClientSecretJwt,
  ClientSecretPost,
  Configuration,
  customFetch,
  type CustomFetch,
  type CustomFetchOptions,
  discovery,
  type FetchBody,
  genericGrantRequest,
  None,
  ResponseBodyError,
} from "openid-client";
import { RefusalCode } from "../../interface-adapters/workflows/effects/enums.js";
import type {
  AuthorizationServer,
  OAuth2Credentials,
} from "../../interface-adapters/workflows/effects/interfaces.js";
import { HttpClientName } from "../network/enums.js";

@Injectable()
export class OpenIdAuthorizationServer implements AuthorizationServer {
  private static readonly JWT_BEARER =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
  ) {}

  async accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string> {
    const configuration = await this.#configurationOf(credentials, signal);
    const token = await this.#granted(configuration, credentials);
    const accepted = this.#issuedByAccepted(token, credentials);

    if (!accepted)
      throw this.#refused(
        "The token was not issued by one of the accepted issuers",
      );

    return token;
  }

  async #configurationOf(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<Configuration> {
    const clientId = credentials.client.id;

    if (clientId === null)
      throw this.#refused("The OAuth2 client needs its id");

    const authentication = this.#clientAuthenticationOf(credentials);
    const fetch = this.#fetchOf(credentials.encoding, signal);

    if (credentials.kind === "oidc")
      return this.#discovered(credentials, clientId, authentication, fetch);

    return this.#configured(credentials, clientId, authentication, fetch);
  }

  #configured(
    credentials: OAuth2Credentials,
    clientId: string,
    authentication: ClientAuth,
    fetch: CustomFetch,
  ): Configuration {
    const tokenEndpoint = this.#tokenEndpointOf(credentials);
    const server = {
      issuer: credentials.authority,
      token_endpoint: tokenEndpoint,
    };
    const configuration = new Configuration(
      server,
      clientId,
      undefined,
      authentication,
    );
    configuration[customFetch] = fetch;
    return configuration;
  }

  async #discovered(
    credentials: OAuth2Credentials,
    clientId: string,
    authentication: ClientAuth,
    fetch: CustomFetch,
  ): Promise<Configuration> {
    const authority = new URL(credentials.authority);
    const options = { [customFetch]: fetch };
    const configuration = await discovery(
      authority,
      clientId,
      undefined,
      authentication,
      options,
    ).catch((error: unknown) => {
      throw this.#refusalOf(
        error,
        "The OpenID provider configuration cannot be read",
      );
    });
    const metadata = configuration.serverMetadata();

    if (metadata.token_endpoint === undefined)
      throw this.#refused(
        "The OpenID provider configuration names no token endpoint",
      );

    const issuers = credentials.issuers;
    const accepted = issuers.length === 0 || issuers.includes(metadata.issuer);

    if (!accepted)
      throw this.#refused(
        "The OpenID provider is not one of the accepted issuers",
      );

    return configuration;
  }

  async #granted(
    configuration: Configuration,
    credentials: OAuth2Credentials,
  ): Promise<string> {
    const parameters = this.#parametersOf(credentials);
    const granted = await genericGrantRequest(
      configuration,
      credentials.grant,
      parameters,
    ).catch((error: unknown) => {
      throw this.#refusalOf(
        error,
        "The authorization server refused to issue a token",
      );
    });
    return granted.access_token;
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

  #clientAuthenticationOf(credentials: OAuth2Credentials): ClientAuth {
    const client = credentials.client;

    switch (client.authentication) {
      case "client_secret_basic": {
        const secret = this.#secretOf(credentials);
        return ClientSecretBasic(secret);
      }
      case "client_secret_post": {
        const secret = this.#secretOf(credentials);
        return ClientSecretPost(secret);
      }
      case "client_secret_jwt": {
        if (client.assertion !== null)
          return this.#assertedBy(client.assertion);

        const secret = this.#secretOf(credentials);
        return ClientSecretJwt(secret);
      }
      case "private_key_jwt":
        if (client.assertion === null)
          throw this.#refused("private_key_jwt needs the client assertion");

        return this.#assertedBy(client.assertion);
      case "none":
        return None();
    }
  }

  #assertedBy(assertion: string): ClientAuth {
    return (_server, _client, body) => {
      body.set("client_assertion_type", OpenIdAuthorizationServer.JWT_BEARER);
      body.set("client_assertion", assertion);
    };
  }

  #secretOf(credentials: OAuth2Credentials): string {
    const client = credentials.client;

    if (client.secret === null)
      throw this.#refused(`${client.authentication} needs the client secret`);

    return client.secret;
  }

  #tokenEndpointOf(credentials: OAuth2Credentials): string {
    const path = credentials.endpoints?.token ?? "/oauth2/token";
    const absolute = URL.canParse(path);

    if (absolute) return path;

    const authority = credentials.authority.replace(/\/+$/, "");
    const relative = path.replace(/^\/+/, "");
    return `${authority}/${relative}`;
  }

  #fetchOf(
    encoding: OAuth2Credentials["encoding"],
    signal: AbortSignal,
  ): CustomFetch {
    return (url, options) => this.#fetched(url, options, encoding, signal);
  }

  async #fetched(
    url: string,
    options: CustomFetchOptions,
    encoding: OAuth2Credentials["encoding"],
    signal: AbortSignal,
  ): Promise<Response> {
    const json = encoding === "application/json";
    const headers = new Headers(options.headers);
    const body = json ? this.#jsonOf(options.body) : options.body;
    const signals =
      options.signal === undefined ? [signal] : [signal, options.signal];
    const scoped = AbortSignal.any(signals);

    if (json) headers.set("content-type", encoding);

    const response = await this.outbound.request(url, {
      method: options.method,
      headers,
      body,
      redirect: options.redirect,
      signal: scoped,
      responseType: "response",
    });
    return response.data;
  }

  #jsonOf(body: FetchBody): FetchBody {
    if (!(body instanceof URLSearchParams)) return body;

    const fields = new Map<string, string | readonly string[]>();

    for (const name of body.keys()) {
      const values = body.getAll(name);
      const [single = ""] = values;
      const value = values.length === 1 ? single : values;
      fields.set(name, value);
    }

    const object = Object.fromEntries(fields);
    return JSON.stringify(object);
  }

  #issuedByAccepted(token: string, credentials: OAuth2Credentials): boolean {
    if (credentials.kind !== "oauth2" || credentials.issuers.length === 0)
      return true;

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
