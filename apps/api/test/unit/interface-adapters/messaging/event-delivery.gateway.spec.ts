import { Secret } from "../../../../src/domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../../../src/domain/automation/subscriptions/enums.js";
import { Subscription } from "../../../../src/domain/automation/subscriptions/subscription.js";
import { EventDeliveryGateway } from "../../../../src/interface-adapters/messaging/event-delivery.gateway.js";
import type {
  EventDeliveries,
  EventDelivery,
} from "../../../../src/interface-adapters/messaging/interfaces.js";

class RecordedDeliveries implements EventDeliveries {
  readonly delivered: EventDelivery[] = [];
  readonly asked: string[] = [];

  admits(uri: string): Promise<boolean> {
    this.asked.push(uri);
    return Promise.resolve(true);
  }

  deliver(delivery: EventDelivery): Promise<string | null> {
    this.delivered.push(delivery);
    return Promise.resolve(null);
  }
}

describe("an event a subscription receives", () => {
  const event = { specversion: "1.0", id: "e-1", source: "/s", type: "t" };
  const accepted = {
    sequence: 1,
    eventId: "e-1",
    type: "t",
    cloudEvent: event,
    acceptedAt: new Date(),
    lifecycleOf: null,
  };

  function subscriptionTo(scheme: DeliveryScheme | null): Subscription {
    const secret = scheme === null ? null : "hook";
    const endpoint = { uri: "https://crm.example/events", scheme, secret };
    return new Subscription({
      id: "subscription-1",
      ownerId: "owner-1",
      name: "crm",
      endpoint,
      filter: {},
      createdAt: new Date(),
    });
  }

  function secretHolding(value: string): Secret {
    const now = new Date();
    const created = Secret.create({
      ownerId: "owner-1",
      name: "hook",
      value,
      now,
    });

    if (!created.ok) throw new TypeError("The secret is refused");

    return created.value;
  }

  it("is_delivered_to_the_subscription_s_endpoint_with_the_secret_s_text", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries);
    const subscription = subscriptionTo(DeliveryScheme.Bearer);
    const secret = secretHolding("tok-abcdef");

    await gateway.send(subscription, secret, accepted);

    expect(deliveries.delivered).toEqual([
      {
        uri: "https://crm.example/events",
        scheme: "bearer",
        credential: "tok-abcdef",
        event,
      },
    ]);
  });

  it("is_delivered_without_a_credential_when_the_endpoint_names_no_secret", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries);
    const subscription = subscriptionTo(null);

    await gateway.send(subscription, null, accepted);

    expect(deliveries.delivered).toEqual([
      {
        uri: "https://crm.example/events",
        scheme: null,
        credential: null,
        event,
      },
    ]);
  });

  it("asks_the_deliveries_whether_an_endpoint_is_admitted", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries);

    const admitted = await gateway.admits("https://crm.example/events");

    expect(admitted).toBe(true);
    expect(deliveries.asked).toEqual(["https://crm.example/events"]);
  });
});
