import { Secret } from "../../../../src/domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../../../src/domain/automation/subscriptions/enums.js";
import { Subscription } from "../../../../src/domain/automation/subscriptions/subscription.js";
import { HOST_PROFILE } from "../../../../src/frameworks/interpreter/host-profile.js";
import { Authenticator } from "../../../../src/interface-adapters/auth/authenticator.js";
import { AccessTokens } from "../../../../src/interface-adapters/auth/interfaces.js";
import { TransportFailure } from "../../../../src/interface-adapters/http/enums.js";
import {
  HttpClient,
  type HttpReply,
  type OutboundRequest,
  type TextReply,
} from "../../../../src/interface-adapters/http/interfaces.js";
import { SubscriberDeliveryGateway } from "../../../../src/interface-adapters/http/subscriber-delivery.gateway.js";
import { TransportFault } from "../../../../src/interface-adapters/http/transport-fault.error.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/interpreter/mappers/protocol.mapper.js";

class NoTokens extends AccessTokens {
  accessTokenFor(): Promise<string> {
    return Promise.reject(new Error("A delivery asks for no token"));
  }
}

class RecordedClient extends HttpClient {
  readonly requests: OutboundRequest[] = [];
  readonly asked: string[] = [];

  constructor(private readonly answer: number | TransportFault = 202) {
    super();
  }

  admits(uri: string): Promise<boolean> {
    this.asked.push(uri);
    return Promise.resolve(true);
  }

  exchange(): Promise<HttpReply> {
    return Promise.reject(new Error("A delivery reads no content"));
  }

  text(request: OutboundRequest): Promise<TextReply> {
    this.requests.push(request);

    if (this.answer instanceof TransportFault)
      return Promise.reject(this.answer);

    return Promise.resolve({ statusCode: this.answer, text: "" });
  }
}

describe("an event a subscription receives", () => {
  const protocol = new ProtocolMapper();
  const authenticator = new Authenticator(new NoTokens(), HOST_PROFILE);
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

  it("posts_the_event_as_a_cloud_event_to_the_subscription_s_endpoint", async () => {
    const client = new RecordedClient();
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );

    const failure = await gateway.send(subscriptionTo(null), null, accepted);

    const [request] = client.requests;
    expect(failure).toBeNull();
    expect(request?.method).toBe("POST");
    expect(request?.uri).toBe("https://crm.example/events");
    expect(request?.headers.get("content-type")).toBe(
      "application/cloudevents+json",
    );
    expect(request?.headers.has("authorization")).toBe(false);
    expect(JSON.parse(request?.body ?? "")).toEqual(event);
  });

  it("is_authenticated_with_a_bare_token_as_a_bearer_policy", async () => {
    const client = new RecordedClient();
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );
    const subscription = subscriptionTo(DeliveryScheme.Bearer);
    const secret = secretHolding("tok-abcdef");

    await gateway.send(subscription, secret, accepted);

    const authorization = client.requests[0]?.headers.get("authorization");
    expect(authorization).toBe("Bearer tok-abcdef");
  });

  it("is_authenticated_with_the_policy_a_secret_holds", async () => {
    const client = new RecordedClient();
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );
    const subscription = subscriptionTo(DeliveryScheme.Basic);
    const policy = '{"username":"ada.lovelace","password":"analytical-1"}';
    const secret = secretHolding(policy);

    await gateway.send(subscription, secret, accepted);

    const pair = Buffer.from("ada.lovelace:analytical-1").toString("base64");
    const authorization = client.requests[0]?.headers.get("authorization");
    expect(authorization).toBe(`Basic ${pair}`);
  });

  it("answers_a_destination_that_refuses_with_its_status", async () => {
    const client = new RecordedClient(503);
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );

    const failure = await gateway.send(subscriptionTo(null), null, accepted);

    expect(failure).toBe("The destination answered 503");
  });

  it("answers_an_unreachable_destination_without_the_secret_s_texts", async () => {
    const fault = new TransportFault(
      TransportFailure.Unreachable,
      "The destination refused ada.lovelace with analytical-1",
    );
    const client = new RecordedClient(fault);
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );
    const subscription = subscriptionTo(DeliveryScheme.Basic);
    const policy = '{"username":"ada.lovelace","password":"analytical-1"}';
    const secret = secretHolding(policy);

    const failure = await gateway.send(subscription, secret, accepted);

    expect(failure).toBe(
      "The destination could not be reached: The destination refused *** with ***",
    );
  });

  it("asks_the_client_whether_an_endpoint_is_admitted", async () => {
    const client = new RecordedClient();
    const gateway = new SubscriberDeliveryGateway(
      client,
      authenticator,
      protocol,
    );

    const admitted = await gateway.admits("https://crm.example/events");

    expect(admitted).toBe(true);
    expect(client.asked).toEqual(["https://crm.example/events"]);
  });
});
