import { Injectable } from "@nestjs/common";
import {
  HttpNetworkError,
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import {
  createSecretPolicies,
  type JsonValue,
  type SecretPolicies,
} from "interpreter";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { EventSender } from "../../application/automation/subscriptions/ports.js";
import type { Secret } from "../../domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../domain/automation/subscriptions/enums.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import { HOST_PROFILE } from "../interpreter/host-profile.js";
import { AddressPolicy } from "./address-policy.js";
import { HttpClientName } from "./enums.js";

@Injectable()
export class DeliveryClient implements EventSender {
  private static readonly NO_PAIR = ":";

  private readonly policy: ResiliencePolicy;
  private readonly policies: SecretPolicies;

  constructor(
    @InjectHttpClient(HttpClientName.Deliveries)
    private readonly deliveries: NestHttpClient,
    private readonly addresses: AddressPolicy,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
    this.policies = createSecretPolicies();
  }

  admits(uri: string): Promise<boolean> {
    const hostname = new URL(uri).hostname;
    return this.addresses.admits(hostname);
  }

  async send(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const endpoint = subscription.endpoint;
    const credential = secret?.value.text ?? null;
    const authorization = this.#authorizationOf(endpoint.scheme, credential);
    const headers = {
      "content-type": "application/cloudevents+json",
      authorization,
    };
    const body = JSON.stringify(event.cloudEvent);
    const failure = await this.#failureOf(endpoint.uri, headers, body);

    if (failure === null || credential === null) return failure;

    return failure.replaceAll(credential, "***");
  }

  async #failureOf(
    uri: string,
    headers: Readonly<Record<string, string | null>>,
    body: string,
  ): Promise<string | null> {
    try {
      const response = await this.policy.execute(({ signal }) =>
        this.deliveries.post(uri, {
          headers,
          body,
          signal,
          responseType: "response",
        }),
      );
      await response.data.body?.cancel();
      const status = String(response.status);
      return response.ok ? null : `The destination answered ${status}`;
    } catch (error) {
      const cause: unknown =
        error instanceof HttpNetworkError ? error.cause : error;
      const reason = cause instanceof Error ? cause.message : "unknown";
      return `The destination could not be reached: ${reason}`;
    }
  }

  #authorizationOf(
    scheme: DeliveryScheme | null,
    credential: string | null,
  ): string | null {
    if (scheme === null || credential === null) return null;

    const value = this.#parsedOf(credential);
    const held = this.policies.authenticationOf(scheme, value, HOST_PROFILE);

    if (scheme === DeliveryScheme.Basic) {
      const pair =
        held.kind === "basic"
          ? `${held.username}:${held.password}`
          : DeliveryClient.NO_PAIR;
      const encoded = Buffer.from(pair, "utf8").toString("base64");
      return `Basic ${encoded}`;
    }

    const token = held.kind === "bearer" ? held.token : credential;
    return `Bearer ${token}`;
  }

  #parsedOf(credential: string): JsonValue {
    try {
      return JSON.parse(credential) as JsonValue;
    } catch {
      return null;
    }
  }
}
