import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule, ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import {
  connect as connectNats,
  headers as natsHeaders,
  type Msg,
} from "@nats-io/transport-node";
import { trace } from "@opentelemetry/api";
import type { AsyncApiRequest, JsonObject } from "interpreter";
import { connectAsync, type Packet } from "mqtt";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { AmqpBroker } from "../../../../src/frameworks/asyncapi/amqp.broker.js";
import { AsyncApiClient } from "../../../../src/frameworks/asyncapi/asyncapi.client.js";
import { AsyncApiDocuments } from "../../../../src/frameworks/asyncapi/asyncapi-documents.js";
import { BrokerTracer } from "../../../../src/frameworks/asyncapi/broker.tracer.js";
import { KafkaBroker } from "../../../../src/frameworks/asyncapi/kafka.broker.js";
import { MqttBroker } from "../../../../src/frameworks/asyncapi/mqtt.broker.js";
import { NatsBroker } from "../../../../src/frameworks/asyncapi/nats.broker.js";
import { RedisBroker } from "../../../../src/frameworks/asyncapi/redis.broker.js";
import {
  resiliencePresets,
  responseSizeLimit,
} from "../../../../src/frameworks/di/host.presets.js";
import { AddressPolicy } from "../../../../src/frameworks/network/address-policy.js";
import type { BrokerSubscription } from "../../../../src/interface-adapters/messaging/interfaces.js";
import {
  startStubServer,
  type StubServer,
} from "../../../support/stub-server.js";
import { RecordedSpans } from "../../../support/recorded-spans.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  resourcesOf,
  inboxOf,
} from "../../../support/outbound.js";

const HOST = "127.0.0.1";
const PRODUCER_SPAN = "00f067aa0ba902b7";
const PRODUCED = `00-4bf92f3577b34da6a3ce929d0e0e4736-${PRODUCER_SPAN}-01`;

function documentOf(protocol: string, host: string, address: string) {
  return {
    asyncapi: "3.0.0",
    info: { title: `${protocol} orders`, version: "1.0.0" },
    servers: { broker: { host, protocol, protocolVersion: "5" } },
    channels: { orders: { address } },
    operations: {
      announce: { action: "send", channel: { $ref: "#/channels/orders" } },
    },
  };
}

describe("the trace context of the messages the AsyncAPI client sends and receives", () => {
  let spans: RecordedSpans;
  let context: INestApplicationContext;
  let client: AsyncApiClient;
  let brokers: readonly { onApplicationShutdown(): Promise<void> }[];
  let documents: StubServer;
  let served: Record<string, JsonObject>;
  let mosquitto: StartedTestContainer;
  let nats: StartedTestContainer;
  const subscriptions: BrokerSubscription[] = [];

  const at = (container: StartedTestContainer, port: number) =>
    `${HOST}:${String(container.getMappedPort(port))}`;

  const requestOf = (
    name: string,
    target: { readonly operation?: string; readonly channel?: string },
    exchange: AsyncApiRequest["exchange"],
  ): AsyncApiRequest => ({
    kind: "asyncapi",
    document: {
      name: null,
      endpoint: { uri: `${documents.origin}/${name}`, authentication: null },
    },
    authentication: null,
    operation: target.operation ?? null,
    channel: target.channel ?? null,
    server: null,
    protocol: null,
    exchange,
  });

  const published: AsyncApiRequest["exchange"] = {
    kind: "publish",
    message: { payload: { order: 1 }, headers: { source: "tenon" } },
  };

  beforeAll(async () => {
    spans = new RecordedSpans();
    [mosquitto, nats] = await Promise.all([
      new GenericContainer("eclipse-mosquitto:2.0.22")
        .withCommand(["mosquitto", "-c", "/mosquitto-no-auth.conf"])
        .withExposedPorts(1883)
        .withWaitStrategy(Wait.forLogMessage(/mosquitto version .* running/))
        .start(),
      new GenericContainer("nats:2.12.2-alpine")
        .withExposedPorts(4222)
        .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
        .start(),
    ]);
    served = {};
    documents = await startStubServer((request, response) => {
      const document = served[request.url.slice(1)];

      if (document === undefined) {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(document));
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    const resilience = context.get(ResilienceService);
    const policy = new AddressPolicy([HOST]);
    const amqp = new AmqpBroker(policy);
    const kafka = new KafkaBroker(policy);
    const mqtt = new MqttBroker(policy);
    const natsBroker = new NatsBroker(policy);
    const redis = new RedisBroker(policy);
    brokers = [amqp, kafka, mqtt, natsBroker, redis];
    client = new AsyncApiClient(
      resourcesOf(policy, resilience),
      authenticationOf(fetchClientOf(policy.dispatcher)),
      new AsyncApiDocuments(),
      new BrokerTracer(),
      responseSizeLimit,
      amqp,
      kafka,
      mqtt,
      natsBroker,
      redis,
      resilience,
    );
  }, 120_000);

  afterAll(async () => {
    const closed = subscriptions.map((subscription) => subscription.close());
    await Promise.allSettled(closed);
    await Promise.all(brokers.map((broker) => broker.onApplicationShutdown()));
    await context.close();
    await documents.close();
    await Promise.all([mosquitto.stop(), nats.stop()]);
    await spans.stop();
  });

  it("an_mqtt_5_publish_carries_the_context_of_its_send_span_in_its_user_properties", async () => {
    served["mqtt.json"] = documentOf("mqtt", at(mosquitto, 1883), "orders/a");
    const subscriber = await connectAsync(`mqtt://${at(mosquitto, 1883)}`, {
      protocolVersion: 5,
    });
    const received: Record<string, string | string[]>[] = [];
    subscriber.on("message", (_topic, _body, packet: Packet) => {
      const properties =
        packet.cmd === "publish" ? packet.properties?.userProperties : {};
      received.push(properties ?? {});
    });
    await subscriber.subscribeAsync("orders/a", { qos: 1 });
    const request = requestOf(
      "mqtt.json",
      { operation: "announce" },
      published,
    );

    const outcome = await client.publish(request, callContextOf("step-1"));
    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    });
    await subscriber.endAsync();
    const span = spans.only("send orders/a").spanContext();

    expect(outcome).toEqual({ kind: "published" });
    expect(received[0]).toEqual({
      source: "tenon",
      traceparent: `00-${span.traceId}-${span.spanId}-01`,
    });
  });

  it("a_nats_publish_carries_the_context_of_its_send_span_in_its_headers", async () => {
    served["nats.json"] = documentOf("nats", at(nats, 4222), "orders.a");
    const subscriber = await connectNats({ servers: at(nats, 4222) });
    const received: Msg[] = [];
    subscriber.subscribe("orders.a", {
      callback: (_error, message) => {
        received.push(message);
      },
    });
    await subscriber.flush();
    const request = requestOf(
      "nats.json",
      { operation: "announce" },
      published,
    );

    const outcome = await client.publish(request, callContextOf("step-2"));
    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    });
    await subscriber.close();
    const span = spans.only("send orders.a").spanContext();

    expect(outcome).toEqual({ kind: "published" });
    expect(received[0]?.headers?.get("source")).toBe("tenon");
    expect(received[0]?.headers?.get("traceparent")).toBe(
      `00-${span.traceId}-${span.spanId}-01`,
    );
  });

  it("a_nats_receive_takes_each_message_in_a_span_linked_to_where_it_was_produced", async () => {
    served["nats-in.json"] = documentOf("nats", at(nats, 4222), "orders.in");
    const active: (string | undefined)[] = [];
    const deliver = () => {
      const span = trace.getActiveSpan();
      active.push(span?.spanContext().spanId);
      return Promise.resolve();
    };
    const receive: AsyncApiRequest["exchange"] = {
      kind: "receive",
      subscription: "/do/0/orders",
      position: 0,
      closesAt: null,
    };
    const request = requestOf("nats-in.json", { channel: "orders" }, receive);
    const outcome = await client.subscribe(
      request,
      callContextOf("receiver-1"),
      inboxOf(deliver),
    );

    if (outcome.kind !== "subscribed")
      throw new Error(`The client did not subscribe: ${outcome.kind}`);

    subscriptions.push(outcome.subscription);
    const publisher = await connectNats({ servers: at(nats, 4222) });
    const sent = natsHeaders();
    sent.set("traceparent", PRODUCED);
    publisher.publish("orders.in", '{"order":2}', { headers: sent });
    await publisher.flush();
    await publisher.close();
    await vi.waitFor(() => {
      expect(active).toHaveLength(1);
    });
    const span = spans.only("process orders.in");

    expect(span.links.map((link) => link.context.spanId)).toEqual([
      PRODUCER_SPAN,
    ]);
    expect(active).toEqual([span.spanContext().spanId]);
    expect(span.attributes["messaging.system"]).toBe("nats");
  });
});
