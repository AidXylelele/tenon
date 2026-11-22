import { Injectable } from "@nestjs/common";
import type { JsonObject as ProtocolObject } from "interpreter";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { EventSender } from "../../application/automation/subscriptions/ports.js";
import type {
  JsonObject,
  JsonValue,
} from "../../domain/automation/interfaces.js";
import type { Secret } from "../../domain/automation/secrets/secret.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import { ProtocolMapper } from "../workflows/mappers/protocol.mapper.js";
import { EventDeliveries, type EventDelivery } from "./interfaces.js";

@Injectable()
export class EventDeliveryGateway implements EventSender {
  private static readonly MASK = "***";

  constructor(
    private readonly deliveries: EventDeliveries,
    private readonly protocol: ProtocolMapper,
  ) {}

  admits(uri: string): Promise<boolean> {
    return this.deliveries.admits(uri);
  }

  async send(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const endpoint = subscription.endpoint;
    const credential = this.#credentialOf(secret);
    const delivery: EventDelivery = {
      uri: endpoint.uri,
      scheme: endpoint.scheme,
      credential,
      event: event.cloudEvent,
    };
    const failure = await this.deliveries.deliver(delivery);

    if (failure === null || secret === null) return failure;

    return this.#masked(failure, secret.value.texts);
  }

  #credentialOf(secret: Secret | null): ProtocolObject | null {
    if (secret === null) return null;

    const held = secret.value.held;

    if (this.#isPolicy(held)) return this.protocol.toObject(held);

    const bearer = { token: held };
    return this.protocol.toObject(bearer);
  }

  #masked(failure: string, texts: readonly string[]): string {
    const longestFirst = texts.toSorted(
      (left, right) => right.length - left.length,
    );
    return longestFirst.reduce(
      (hidden, text) => hidden.replaceAll(text, EventDeliveryGateway.MASK),
      failure,
    );
  }

  #isPolicy(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
