import { Injectable } from "@nestjs/common";
import { HttpNetworkError } from "@nestjs/http-client";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { Authentication, JsonObject } from "interpreter";
import { Authenticator } from "../workflows/effects/authenticator.js";
import {
  type Authorization,
  HttpConnection,
} from "../workflows/effects/interfaces.js";
import type { EventDeliveries, EventDelivery } from "./interfaces.js";

@Injectable()
export class HttpDeliveryGateway implements EventDeliveries {
  private static readonly SECRET = "subscription";

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly connection: HttpConnection,
    private readonly authenticator: Authenticator,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  admits(uri: string): Promise<boolean> {
    return this.connection.admits(uri);
  }

  async deliver(delivery: EventDelivery): Promise<string | null> {
    try {
      return await this.policy.execute(({ signal }) =>
        this.#delivered(delivery, signal),
      );
    } catch (error) {
      const cause: unknown =
        error instanceof HttpNetworkError ? error.cause : error;
      const reason = cause instanceof Error ? cause.message : "unknown";
      return `The destination could not be reached: ${reason}`;
    }
  }

  async #delivered(
    delivery: EventDelivery,
    signal: AbortSignal,
  ): Promise<string | null> {
    const authentication = this.#authenticationOf(delivery);
    const secrets = this.#secretsOf(delivery);
    const authorization = await this.authenticator.authorizationOf(
      authentication,
      secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization.detail;

    if (authorization.kind === "misconfigured") return authorization.detail;

    const headers = this.#headersOf(authorization);
    return this.#posted(delivery, headers, signal);
  }

  async #posted(
    delivery: EventDelivery,
    headers: Headers,
    signal: AbortSignal,
  ): Promise<string | null> {
    const body = JSON.stringify(delivery.event);
    const response = await this.connection.fetch(delivery.uri, {
      method: "POST",
      headers,
      body,
      signal,
    });
    await response.body?.cancel();
    const status = String(response.status);
    return response.ok ? null : `The destination answered ${status}`;
  }

  #headersOf(authorization: Authorization): Headers {
    const headers = new Headers({
      "content-type": "application/cloudevents+json",
    });

    if (authorization.kind === "header") {
      const value = this.authenticator.headerValueOf(authorization.header);
      headers.set("authorization", value);
    }

    return headers;
  }

  #authenticationOf(delivery: EventDelivery): Authentication | null {
    const scheme = delivery.scheme;

    if (scheme === null || delivery.credential === null) return null;

    return { kind: "secret", scheme, secret: HttpDeliveryGateway.SECRET };
  }

  #secretsOf(delivery: EventDelivery): JsonObject {
    const credential = delivery.credential;

    if (credential === null) return {};

    return { [HttpDeliveryGateway.SECRET]: credential };
  }
}
