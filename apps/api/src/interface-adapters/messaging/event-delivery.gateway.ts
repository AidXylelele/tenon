import { Injectable } from "@nestjs/common";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { EventSender } from "../../application/automation/subscriptions/ports.js";
import type { Secret } from "../../domain/automation/secrets/secret.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import { EventDeliveries, type EventDelivery } from "./interfaces.js";

@Injectable()
export class EventDeliveryGateway implements EventSender {
  constructor(private readonly deliveries: EventDeliveries) {}

  admits(uri: string): Promise<boolean> {
    return this.deliveries.admits(uri);
  }

  send(
    subscription: Subscription,
    secret: Secret | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const endpoint = subscription.endpoint;
    const delivery: EventDelivery = {
      uri: endpoint.uri,
      scheme: endpoint.scheme,
      credential: secret?.value.text ?? null,
      event: event.cloudEvent,
    };
    return this.deliveries.deliver(delivery);
  }
}
