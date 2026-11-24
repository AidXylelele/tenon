import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Test } from "@nestjs/testing";
import { ResilienceService } from "@nestjs/resilience";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../../src/frameworks/di/host.presets.js";
import type { JsonObject } from "../../../../src/domain/automation/interfaces.js";
import { Secret } from "../../../../src/domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../../../src/domain/automation/subscriptions/enums.js";
import { Subscription } from "../../../../src/domain/automation/subscriptions/subscription.js";
import { AddressPolicy } from "../../../../src/frameworks/http/address-policy.js";
import { SubscriberDeliveryGateway } from "../../../../src/interface-adapters/http/subscriber-delivery.gateway.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/interpreter/mappers/protocol.mapper.js";
import { authenticationOf, clientOf } from "../../../support/outbound.js";

describe("a delivery and the outbound address policy", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let server: Server;
  let received = 0;
  let authorization: string | null = null;
  let body = "";
  let port = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    server = createServer((request, response) => {
      received += 1;
      authorization = request.headers.authorization ?? null;
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        body = Buffer.concat(chunks).toString("utf8");
        const status = request.url === "/moved" ? 302 : 202;
        response.writeHead(status, { location: "/events" }).end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await context.close();
  });

  beforeEach(() => {
    received = 0;
    authorization = null;
    body = "";
  });

  const event = { specversion: "1.0", id: "e-1", source: "/s", type: "t" };
  const accepted = {
    sequence: 1,
    eventId: "e-1",
    type: "t",
    cloudEvent: event,
    acceptedAt: new Date(),
    lifecycleOf: null,
  };

  interface Delivery {
    readonly subscription: Subscription;
    readonly secret: Secret | null;
  }

  function deliveryTo(
    uri: string,
    scheme: DeliveryScheme | null = null,
    credential: JsonObject | null = null,
  ): Delivery {
    const named = credential === null ? null : "hook";
    const endpoint = { uri, scheme, secret: named };
    const subscription = new Subscription({
      id: "subscription-1",
      ownerId: "owner-1",
      name: "crm",
      endpoint,
      filter: {},
      createdAt: new Date(),
    });
    const secret = credential === null ? null : secretHolding(credential);
    return { subscription, secret };
  }

  function secretHolding(credential: JsonObject): Secret {
    const value = JSON.stringify(credential);
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

  function gatewayOf(policy: AddressPolicy): SubscriberDeliveryGateway {
    return new SubscriberDeliveryGateway(
      clientOf(policy, resilience),
      authenticationOf(policy, resilience),
      new ProtocolMapper(),
    );
  }

  function delivered(
    gateway: SubscriberDeliveryGateway,
    delivery: Delivery,
  ): Promise<string | null> {
    return gateway.send(delivery.subscription, delivery.secret, accepted);
  }

  it("a_loopback_destination_is_refused_before_any_connection", async () => {
    const policy = new AddressPolicy([]);
    const client = gatewayOf(policy);
    const delivery = deliveryTo(`http://localhost:${String(port)}/events`);

    const error = await delivered(client, delivery);

    expect(error).toMatch(/could not be reached/);
    expect(received).toBe(0);
    await policy.onApplicationShutdown();
  });

  it.each([
    ["a link-local address", "http://169.254.169.254/latest", false],
    ["a loopback address", "http://[::1]/events", false],
    ["a private address", "http://10.0.0.1/events", false],
    ["an IPv4-mapped private address", "http://[::ffff:10.0.0.1]/", false],
    ["an IPv4-compatible address", "http://[::10.0.0.1]/events", false],
    ["a documentation address", "http://192.0.2.1/events", false],
    ["a unique-local address", "http://[fd00::1]/events", false],
    ["an allow-listed address", "http://127.0.0.1/events", true],
    ["an address of an allow-listed network", "http://10.1.2.3/", true],
    ["a public address", "https://93.184.215.14/events", true],
    ["a public IPv6 address", "https://[2606:4700::1111]/events", true],
  ] as const)(
    "%s_is_admitted_as_an_endpoint_only_when_the_policy_permits_it",
    async (_address, uri, admitted) => {
      const policy = new AddressPolicy(["127.0.0.1", "10.1.0.0/16"]);
      const client = gatewayOf(policy);

      const admits = await client.admits(uri);

      expect(admits).toBe(admitted);
      await policy.onApplicationShutdown();
    },
  );

  it("an_allow_listed_destination_takes_the_event_as_a_cloud_event", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = gatewayOf(policy);
    const delivery = deliveryTo(`http://127.0.0.1:${String(port)}/events`);

    const error = await delivered(client, delivery);

    expect(error).toBeNull();
    expect(received).toBe(1);
    expect(JSON.parse(body)).toEqual(event);
    await policy.onApplicationShutdown();
  });

  it("a_destination_that_redirects_is_answered_as_refused_and_not_followed", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = gatewayOf(policy);
    const delivery = deliveryTo(`http://127.0.0.1:${String(port)}/moved`);

    const error = await delivered(client, delivery);

    expect(error).toBe("The destination answered 302");
    expect(received).toBe(1);
    await policy.onApplicationShutdown();
  });

  it.each([
    [
      "basic credentials",
      DeliveryScheme.Basic,
      { username: "ada.lovelace", password: "analytical-1" },
      `Basic ${Buffer.from("ada.lovelace:analytical-1").toString("base64")}`,
    ],
    [
      "a bearer token",
      DeliveryScheme.Bearer,
      { token: "tok-abcdef" },
      "Bearer tok-abcdef",
    ],
  ] as const)(
    "a_credential_holding_%s_authenticates_the_delivery",
    async (_holding, scheme, credential, expected) => {
      const policy = new AddressPolicy(["127.0.0.1"]);
      const client = gatewayOf(policy);
      const uri = `http://127.0.0.1:${String(port)}/events`;
      const delivery = deliveryTo(uri, scheme, credential);

      const error = await delivered(client, delivery);

      expect(error).toBeNull();
      expect(authorization).toBe(expected);
      await policy.onApplicationShutdown();
    },
  );

  it("a_credential_that_is_not_a_basic_policy_is_refused_before_any_connection", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = gatewayOf(policy);
    const uri = `http://127.0.0.1:${String(port)}/events`;
    const credential = { token: "ada.lovelace" };
    const delivery = deliveryTo(uri, DeliveryScheme.Basic, credential);

    const error = await delivered(client, delivery);

    expect(error).toMatch(/^The secret's basic policy is refused: /);
    expect(received).toBe(0);
    await policy.onApplicationShutdown();
  });
});
