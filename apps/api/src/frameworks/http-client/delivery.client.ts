import { Injectable } from "@nestjs/common";
import {
  HttpNetworkError,
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { Authentication, JsonObject } from "interpreter";
import type {
  EventDeliveries,
  EventDelivery,
} from "../../interface-adapters/messaging/interfaces.js";
import { AddressPolicy } from "./address-policy.js";
import { HttpClientName } from "./enums.js";
import { HttpAuthentication } from "./http-authentication.js";
import type { Authorization } from "./interfaces.js";

@Injectable()
export class DeliveryClient implements EventDeliveries {
  private static readonly SECRET = "subscription";

  private readonly policy: ResiliencePolicy;

  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
    private readonly addresses: AddressPolicy,
    private readonly authentication: HttpAuthentication,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  admits(uri: string): Promise<boolean> {
    const hostname = new URL(uri).hostname;
    return this.addresses.admits(hostname);
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
    const authorization = await this.authentication.authorizationOf(
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
    headers: Readonly<Record<string, string | null>>,
    signal: AbortSignal,
  ): Promise<string | null> {
    const body = JSON.stringify(delivery.event);
    const response = await this.outbound.post(delivery.uri, {
      headers,
      body,
      redirect: "manual",
      signal,
      responseType: "response",
    });
    await response.data.body?.cancel();
    const status = String(response.status);
    return response.ok ? null : `The destination answered ${status}`;
  }

  #headersOf(
    authorization: Authorization,
  ): Readonly<Record<string, string | null>> {
    const value =
      authorization.kind === "header"
        ? this.authentication.headerValueOf(authorization.header)
        : null;
    return {
      "content-type": "application/cloudevents+json",
      authorization: value,
    };
  }

  #authenticationOf(delivery: EventDelivery): Authentication | null {
    const scheme = delivery.scheme;

    if (scheme === null || delivery.credential === null) return null;

    return { kind: "secret", scheme, secret: DeliveryClient.SECRET };
  }

  #secretsOf(delivery: EventDelivery): JsonObject {
    const credential = delivery.credential;

    if (credential === null) return {};

    return { [DeliveryClient.SECRET]: credential };
  }
}
