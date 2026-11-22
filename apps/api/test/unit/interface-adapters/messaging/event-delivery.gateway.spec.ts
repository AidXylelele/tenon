import { Secret } from "../../../../src/domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../../../src/domain/automation/subscriptions/enums.js";
import { Subscription } from "../../../../src/domain/automation/subscriptions/subscription.js";
import { EventDeliveryGateway } from "../../../../src/interface-adapters/messaging/event-delivery.gateway.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/workflows/mappers/protocol.mapper.js";
import type {
  EventDeliveries,
  EventDelivery,
} from "../../../../src/interface-adapters/messaging/interfaces.js";

class RecordedDeliveries implements EventDeliveries {
  readonly delivered: EventDelivery[] = [];
  readonly asked: string[] = [];

  constructor(private readonly failure: string | null = null) {}

  admits(uri: string): Promise<boolean> {
    this.asked.push(uri);
    return Promise.resolve(true);
  }

  deliver(delivery: EventDelivery): Promise<string | null> {
    this.delivered.push(delivery);
    return Promise.resolve(this.failure);
  }
}

describe("an event a subscription receives", () => {
  const protocol = new ProtocolMapper();
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

  it("is_delivered_to_the_subscription_s_endpoint_with_a_bare_token_as_a_bearer_policy", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries, protocol);
    const subscription = subscriptionTo(DeliveryScheme.Bearer);
    const secret = secretHolding("tok-abcdef");

    await gateway.send(subscription, secret, accepted);

    expect(deliveries.delivered).toEqual([
      {
        uri: "https://crm.example/events",
        scheme: "bearer",
        credential: { token: "tok-abcdef" },
        event,
      },
    ]);
  });

  it("is_delivered_with_the_policy_a_secret_holds", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries, protocol);
    const subscription = subscriptionTo(DeliveryScheme.Basic);
    const policy = '{"username":"ada.lovelace","password":"analytical-1"}';
    const secret = secretHolding(policy);

    await gateway.send(subscription, secret, accepted);

    expect(deliveries.delivered[0]?.credential).toEqual({
      username: "ada.lovelace",
      password: "analytical-1",
    });
  });

  it("answers_a_refused_delivery_without_the_secret_s_texts", async () => {
    const deliveries = new RecordedDeliveries(
      "The destination refused ada.lovelace with analytical-1",
    );
    const gateway = new EventDeliveryGateway(deliveries, protocol);
    const subscription = subscriptionTo(DeliveryScheme.Basic);
    const policy = '{"username":"ada.lovelace","password":"analytical-1"}';
    const secret = secretHolding(policy);

    const failure = await gateway.send(subscription, secret, accepted);

    expect(failure).toBe("The destination refused *** with ***");
  });

  it("is_delivered_without_a_credential_when_the_endpoint_names_no_secret", async () => {
    const deliveries = new RecordedDeliveries();
    const gateway = new EventDeliveryGateway(deliveries, protocol);
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
    const gateway = new EventDeliveryGateway(deliveries, protocol);

    const admitted = await gateway.admits("https://crm.example/events");

    expect(admitted).toBe(true);
    expect(deliveries.asked).toEqual(["https://crm.example/events"]);
  });
});
