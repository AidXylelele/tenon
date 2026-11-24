import { Injectable } from "@nestjs/common";
import {
  type ClientAuth,
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
} from "openid-client";
import { UndiciHttpClient } from "../http/undici.http-client.js";
import type {
  ClientAuthentication,
  TokenClient,
  TokenEndpoint,
} from "./interfaces.js";

@Injectable()
export class OpenIdAuthorizationServer {
  private static readonly JWT_BEARER =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

  constructor(private readonly http: UndiciHttpClient) {}

  async endpointOf(
    client: TokenClient,
    signal: AbortSignal,
  ): Promise<TokenEndpoint> {
    const authentication = this.#clientAuthenticationOf(client.authentication);
    const fetch = this.#fetchOf(client.encoding, signal);
    const configuration = await this.#configurationOf(
      client,
      authentication,
      fetch,
    );
    const metadata = configuration.serverMetadata();
    const located = metadata.token_endpoint !== undefined;
    return {
      issuer: metadata.issuer,
      located,
      grant: (type, parameters) =>
        this.#granted(configuration, type, parameters),
    };
  }

  #configurationOf(
    client: TokenClient,
    authentication: ClientAuth,
    fetch: CustomFetch,
  ): Promise<Configuration> {
    const tokenEndpoint = client.tokenEndpoint;

    if (tokenEndpoint === null)
      return this.#discovered(client, authentication, fetch);

    const configured = this.#configured(
      client,
      tokenEndpoint,
      authentication,
      fetch,
    );
    return Promise.resolve(configured);
  }

  #configured(
    client: TokenClient,
    tokenEndpoint: string,
    authentication: ClientAuth,
    fetch: CustomFetch,
  ): Configuration {
    const server = { issuer: client.authority, token_endpoint: tokenEndpoint };
    const configuration = new Configuration(
      server,
      client.id,
      undefined,
      authentication,
    );
    configuration[customFetch] = fetch;
    return configuration;
  }

  #discovered(
    client: TokenClient,
    authentication: ClientAuth,
    fetch: CustomFetch,
  ): Promise<Configuration> {
    const authority = new URL(client.authority);
    const options = { [customFetch]: fetch };
    return discovery(authority, client.id, undefined, authentication, options);
  }

  async #granted(
    configuration: Configuration,
    type: string,
    parameters: URLSearchParams,
  ): Promise<string> {
    const granted = await genericGrantRequest(configuration, type, parameters);
    return granted.access_token;
  }

  #clientAuthenticationOf(authentication: ClientAuthentication): ClientAuth {
    switch (authentication.kind) {
      case "client_secret_basic":
        return ClientSecretBasic(authentication.secret);
      case "client_secret_post":
        return ClientSecretPost(authentication.secret);
      case "client_secret_jwt":
        return ClientSecretJwt(authentication.secret);
      case "assertion":
        return this.#assertedBy(authentication.assertion);
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

  #fetchOf(
    encoding: TokenClient["encoding"],
    signal: AbortSignal,
  ): CustomFetch {
    return (url, options) => this.#fetched(url, options, encoding, signal);
  }

  #fetched(
    url: string,
    options: CustomFetchOptions,
    encoding: TokenClient["encoding"],
    signal: AbortSignal,
  ): Promise<Response> {
    const json = encoding === "application/json";
    const headers = new Headers(options.headers);
    const body = json ? this.#jsonOf(options.body) : options.body;
    const signals =
      options.signal === undefined ? [signal] : [signal, options.signal];
    const scoped = AbortSignal.any(signals);

    if (json) headers.set("content-type", encoding);

    return this.http.fetch(url, {
      method: options.method,
      headers,
      body,
      redirect: options.redirect,
      signal: scoped,
    });
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
}
