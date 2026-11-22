import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Test } from "@nestjs/testing";
import { ResilienceService } from "@nestjs/resilience";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../../src/frameworks/di/host.presets.js";
import { AddressPolicy } from "../../../../src/frameworks/http-client/address-policy.js";
import { DeliveryClient } from "../../../../src/frameworks/http-client/delivery.client.js";
import type { EventDelivery } from "../../../../src/interface-adapters/messaging/interfaces.js";
import { authenticationOf, fetchClientOf } from "../../../support/outbound.js";

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

  function deliveryTo(
    uri: string,
    scheme: EventDelivery["scheme"] = null,
    credential: EventDelivery["credential"] = null,
  ): EventDelivery {
    return { uri, scheme, credential, event };
  }

  function clientOf(policy: AddressPolicy): DeliveryClient {
    const outbound = fetchClientOf(policy.dispatcher);
    const authentication = authenticationOf(outbound);
    return new DeliveryClient(outbound, policy, authentication, resilience);
  }

  it("a_loopback_destination_is_refused_before_any_connection", async () => {
    const policy = new AddressPolicy([]);
    const client = clientOf(policy);
    const delivery = deliveryTo(`http://localhost:${String(port)}/events`);

    const error = await client.deliver(delivery);

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
      const client = clientOf(policy);

      const admits = await client.admits(uri);

      expect(admits).toBe(admitted);
      await policy.onApplicationShutdown();
    },
  );

  it("an_allow_listed_destination_takes_the_event_as_a_cloud_event", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = clientOf(policy);
    const delivery = deliveryTo(`http://127.0.0.1:${String(port)}/events`);

    const error = await client.deliver(delivery);

    expect(error).toBeNull();
    expect(received).toBe(1);
    expect(JSON.parse(body)).toEqual(event);
    await policy.onApplicationShutdown();
  });

  it("a_destination_that_redirects_is_answered_as_refused_and_not_followed", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = clientOf(policy);
    const delivery = deliveryTo(`http://127.0.0.1:${String(port)}/moved`);

    const error = await client.deliver(delivery);

    expect(error).toBe("The destination answered 302");
    expect(received).toBe(1);
    await policy.onApplicationShutdown();
  });

  it.each([
    [
      "basic credentials",
      "basic",
      { username: "ada.lovelace", password: "analytical-1" },
      `Basic ${Buffer.from("ada.lovelace:analytical-1").toString("base64")}`,
    ],
    ["a bearer token", "bearer", { token: "tok-abcdef" }, "Bearer tok-abcdef"],
  ] as const)(
    "a_credential_holding_%s_authenticates_the_delivery",
    async (_holding, scheme, credential, expected) => {
      const policy = new AddressPolicy(["127.0.0.1"]);
      const client = clientOf(policy);
      const uri = `http://127.0.0.1:${String(port)}/events`;
      const delivery = deliveryTo(uri, scheme, credential);

      const error = await client.deliver(delivery);

      expect(error).toBeNull();
      expect(authorization).toBe(expected);
      await policy.onApplicationShutdown();
    },
  );

  it("a_credential_that_is_not_a_basic_policy_is_refused_before_any_connection", async () => {
    const policy = new AddressPolicy(["127.0.0.1"]);
    const client = clientOf(policy);
    const uri = `http://127.0.0.1:${String(port)}/events`;
    const credential = { token: "ada.lovelace" };
    const delivery = deliveryTo(uri, "basic", credential);

    const error = await client.deliver(delivery);

    expect(error).toMatch(/^The secret's basic policy is refused: /);
    expect(received).toBe(0);
    await policy.onApplicationShutdown();
  });
});
