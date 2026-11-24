import { Injectable } from "@nestjs/common";
import type { Authentication, JsonObject as ProtocolObject } from "interpreter";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { EventSender } from "../../application/automation/subscriptions/ports.js";
import type {
  JsonObject,
  JsonValue,
} from "../../domain/automation/interfaces.js";
import type { Secret } from "../../domain/automation/secrets/secret.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import { Authenticator } from "../auth/authenticator.js";
import type { Authorization } from "../auth/interfaces.js";
import { ProtocolMapper } from "../interpreter/mappers/protocol.mapper.js";
import { HttpClient } from "./interfaces.js";

@Injectable()
export class SubscriberDeliveryGateway implements EventSender {
  private static readonly SECRET = "subscription";
  private static readonly MASK = "***";

  constructor(
    private readonly client: HttpClient,
    private readonly authenticator: Authenticator,
    private readonly protocol: ProtocolMapper,
  ) {}

  admits(uri: string): Promise<boolean> {
    return this.client.admits(uri);
  }

  async send(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const failure = await this.#delivered(subscription, secret, event);

    if (failure === null || secret === null) return failure;

    return this.#masked(failure, secret.value.texts);
  }

  async #delivered(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    try {
      return await this.#posted(subscription, secret, event);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      return `The destination could not be reached: ${reason}`;
    }
  }

  async #posted(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const endpoint = subscription.endpoint;
    const signal = new AbortController().signal;
    const authentication = this.#authenticationOf(subscription, secret);
    const secrets = this.#secretsOf(secret);
    const authorization = await this.authenticator.authorizationOf(
      authentication,
      secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization.detail;

    if (authorization.kind === "misconfigured") return authorization.detail;

    const headers = this.#headersOf(authorization);
    const cloudEvent = this.protocol.toObject(event.cloudEvent);
    const body = JSON.stringify(cloudEvent);
    const request = { method: "POST", uri: endpoint.uri, headers, body };
    const reply = await this.client.text(request, signal);
    const ok = reply.statusCode >= 200 && reply.statusCode <= 299;
    const status = String(reply.statusCode);
    return ok ? null : `The destination answered ${status}`;
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

  #authenticationOf(
    subscription: Subscription,
    secret: Secret | null,
  ): Authentication | null {
    const scheme = subscription.endpoint.scheme;

    if (scheme === null || secret === null) return null;

    return {
      kind: "secret",
      scheme,
      secret: SubscriberDeliveryGateway.SECRET,
    };
  }

  #secretsOf(secret: Secret | null): ProtocolObject {
    if (secret === null) return {};

    const credential = this.#credentialOf(secret.value.held);
    return { [SubscriberDeliveryGateway.SECRET]: credential };
  }

  #credentialOf(held: JsonValue): ProtocolObject {
    const policy = this.#isPolicy(held);

    if (policy) return this.protocol.toObject(held);

    const bearer = { token: held };
    return this.protocol.toObject(bearer);
  }

  #masked(failure: string, texts: readonly string[]): string {
    const longestFirst = texts.toSorted(
      (left, right) => right.length - left.length,
    );
    return longestFirst.reduce(
      (hidden, text) => hidden.replaceAll(text, SubscriberDeliveryGateway.MASK),
      failure,
    );
  }

  #isPolicy(value: JsonValue): value is JsonObject {
    const list = Array.isArray(value);
    return typeof value === "object" && value !== null && !list;
  }
}
