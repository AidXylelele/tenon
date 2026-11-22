import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Test } from "@nestjs/testing";
import { ResilienceService } from "@nestjs/resilience";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../src/frameworks/di/resilience.presets.js";
import { AddressPolicy } from "../../../src/frameworks/http-client/address-policy.js";
import { DeliveryClient } from "../../../src/frameworks/http-client/delivery.client.js";
import { Secret } from "../../../src/domain/automation/secrets/secret.js";
import { DeliveryScheme } from "../../../src/domain/automation/subscriptions/enums.js";
import { Subscription } from "../../../src/domain/automation/subscriptions/subscription.js";
import { fetchClientOf } from "./outbound.js";

describe("a delivery and the outbound address policy", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let server: Server;
  let received = 0;
  let authorization: string | null = null;
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
      response.writeHead(202).end();
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

  function subscriptionTo(
    uri: string,
    scheme: DeliveryScheme | null = null,
  ): Subscription {
    const secret = scheme === null ? null : "hook";
    const endpoint = { uri, scheme, secret };
    return new Subscription({
      id: "subscription-1",
      ownerId: "owner-1",
      name: "crm",
      endpoint,
      filter: {},
      createdAt: new Date(),
    });
  }

  it("a_loopback_destination_is_refused_before_any_connection", async () => {
    const policy = new AddressPolicy([]);
    const client = new DeliveryClient(
      fetchClientOf(policy.dispatcher),
      policy,
      resilience,
    );

    const subscription = subscriptionTo(
      `http://localhost:${String(port)}/events`,
    );
    const error = await client.send(subscription, null, accepted);

    expect(error).toMatch(/could not be reached/);
    expect(received).toBe(0);
    await policy.onApplicationShutdown();
  });

  it.each([
    ["a link-local address", "http://169.254.169.254/latest", false],
    ["a loopback address", "http://[::1]/events", false],
    ["a private address", "http://10.0.0.1/events", false],
    ["an allow-listed address", "http://127.0.0.1/events", true],
    ["a public address", "https://93.184.215.14/events", true],
  ] as const)(
    "%s_is_admitted_as_an_endpoint_only_when_the_policy_permits_it",
    async (_address, uri, admitted) => {
      const policy = new AddressPolicy(["127.0.0.1"]);
      const client = new DeliveryClient(
        fetchClientOf(policy.dispatcher),
        policy,
        resilience,
      );

      const admits = await client.admits(uri);

      expect(admits).toBe(admitted);
      await policy.onApplicationShutdown();
    },
  );

  it("an_allow_listed_destination_takes_the_delivery", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = new DeliveryClient(
      fetchClientOf(policy.dispatcher),
      policy,
      resilience,
    );

    const subscription = subscriptionTo(
      `http://127.0.0.1:${String(port)}/events`,
    );
    const error = await client.send(subscription, null, accepted);

    expect(error).toBeNull();
    expect(received).toBe(1);
    await policy.onApplicationShutdown();
  });

  it.each([
    [
      "basic credentials",
      DeliveryScheme.Basic,
      '{"username":"ada.lovelace","password":"analytical-1"}',
      `Basic ${Buffer.from("ada.lovelace:analytical-1").toString("base64")}`,
    ],
    [
      "a bearer token object",
      DeliveryScheme.Bearer,
      '{"token":"tok-abcdef"}',
      "Bearer tok-abcdef",
    ],
    [
      "a bare bearer token",
      DeliveryScheme.Bearer,
      "tok-abcdef",
      "Bearer tok-abcdef",
    ],
  ] as const)(
    "a_secret_holding_%s_authenticates_the_delivery",
    async (_holding, scheme, value, expected) => {
      const policy = new AddressPolicy(["127.0.0.1"]);
      const client = new DeliveryClient(
        fetchClientOf(policy.dispatcher),
        policy,
        resilience,
      );
      const created = Secret.create({
        ownerId: "owner-1",
        name: "hook",
        value,
        now: new Date(),
      });

      if (!created.ok) throw new TypeError("The secret is refused");

      const subscription = subscriptionTo(
        `http://127.0.0.1:${String(port)}/events`,
        scheme,
      );
      const error = await client.send(subscription, created.value, accepted);

      expect(error).toBeNull();
      expect(authorization).toBe(expected);
      await policy.onApplicationShutdown();
    },
  );
});
