import type { LookupAddress, LookupOptions } from "node:dns";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule, ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import {
  Admin,
  Consumer,
  MessagesStreamModes,
  Producer,
  stringDeserializers,
  stringSerializers,
} from "@platformatic/kafka";
import {
  KafkaContainer,
  type StartedKafkaContainer,
} from "@testcontainers/kafka";
import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  JsonObject,
} from "interpreter";
import { AmqpBroker } from "../../../src/frameworks/asyncapi/amqp.broker.js";
import { AsyncApiClient } from "../../../src/frameworks/asyncapi/asyncapi.client.js";
import { AsyncApiDocuments } from "../../../src/frameworks/asyncapi/asyncapi-documents.js";
import type { BrokerSubscription } from "../../../src/interface-adapters/messaging/interfaces.js";
import { KafkaBroker } from "../../../src/frameworks/asyncapi/kafka.broker.js";
import { MqttBroker } from "../../../src/frameworks/asyncapi/mqtt.broker.js";
import { NatsBroker } from "../../../src/frameworks/asyncapi/nats.broker.js";
import { RedisBroker } from "../../../src/frameworks/asyncapi/redis.broker.js";
import { resiliencePresets } from "../../../src/frameworks/di/resilience.presets.js";
import { AddressPolicy } from "../../../src/frameworks/http-client/address-policy.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  inboxOf,
  httpClientOf,
} from "./outbound.js";

const HOST = "127.0.0.1";
const LOOPBACK = ["127.0.0.1", "::1"];
const PORT = 9093;
const PROBE = '{"probe":true}';
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";

class AdvertisedNameRefused extends AddressPolicy {
  constructor(private readonly advertised: string) {
    super(LOOPBACK);
  }

  override resolve(
    hostname: string,
    family: LookupOptions["family"],
  ): Promise<readonly LookupAddress[]> {
    if (hostname === this.advertised) return super.resolve("10.0.0.1", family);

    return super.resolve(hostname, family);
  }
}

function documentOf(bootstrap: string, topic: string): JsonObject {
  return {
    asyncapi: "3.0.0",
    info: { title: "kafka orders", version: "1.0.0" },
    servers: { broker: { host: bootstrap, protocol: "kafka" } },
    channels: {
      orders: {
        address: topic,
        messages: { paid: { contentType: "application/json", payload: {} } },
      },
    },
  };
}

describe("the AsyncAPI client on a Kafka cluster a document names", () => {
  let context: INestApplicationContext;
  let kafka: StartedKafkaContainer;
  let documents: StubServer;
  let served: Record<string, JsonObject>;
  let bootstrap: string;
  let advertised: string;
  let resilience: ResilienceService;
  let broker: KafkaBroker;
  let client: AsyncApiClient;
  let admin: Admin;
  let producer: Producer<string, string, string, string>;
  const subscriptions: BrokerSubscription[] = [];

  const clientOn = (policy: AddressPolicy, kafkaBroker: KafkaBroker) =>
    new AsyncApiClient(
      httpClientOf(new AddressPolicy([HOST]), resilience),
      authenticationOf(fetchClientOf(policy.dispatcher)),
      new AsyncApiDocuments(),
      new AmqpBroker(policy),
      kafkaBroker,
      new MqttBroker(policy),
      new NatsBroker(policy),
      new RedisBroker(policy),
      resilience,
    );

  const requestOf = (
    name: string,
    exchange: AsyncApiRequest["exchange"],
  ): AsyncApiRequest => ({
    kind: "asyncapi",
    document: {
      name: null,
      endpoint: { uri: `${documents.origin}/${name}`, authentication: null },
    },
    authentication: null,
    operation: null,
    channel: "orders",
    server: null,
    protocol: null,
    exchange,
  });

  const receive: AsyncApiRequest["exchange"] = {
    kind: "receive",
    subscription: "/do/0/orders",
    position: 0,
    closesAt: null,
  };

  const topicFor = async (name: string) => {
    await admin.createTopics({ topics: [name], partitions: 1, replicas: 1 });
    served[`${name}.json`] = documentOf(bootstrap, name);
    return requestOf(`${name}.json`, receive);
  };

  const subscribed = async (
    request: AsyncApiRequest,
    subscriber: string,
    deliver: (message: AsyncApiInboundMessage) => Promise<void>,
    lost: () => void = () => {},
  ) => {
    const call = callContextOf(subscriber);
    const outcome = await client.subscribe(
      request,
      call,
      inboxOf(deliver, lost),
    );

    if (outcome.kind !== "subscribed")
      throw new Error(`The client did not subscribe: ${outcome.kind}`);

    subscriptions.push(outcome.subscription);
    return outcome.subscription;
  };

  const produced = (topic: string, value: string, headers = {}) =>
    producer.send({ messages: [{ topic, value, headers }] });

  const isProbe = (message: AsyncApiInboundMessage) =>
    JSON.stringify(message.payload) === PROBE;

  const realOf = (inbox: readonly AsyncApiInboundMessage[]) =>
    inbox.filter((message) => !isProbe(message));

  const joined = (topic: string, inbox: readonly AsyncApiInboundMessage[]) =>
    vi.waitFor(
      async () => {
        await produced(topic, PROBE);
        expect(inbox.some(isProbe)).toBe(true);
      },
      { timeout: 30_000, interval: 500 },
    );

  beforeAll(async () => {
    kafka = await new KafkaContainer("confluentinc/cp-kafka:8.1.0").start();
    advertised = kafka.getHost();
    bootstrap = `${HOST}:${String(kafka.getMappedPort(PORT))}`;
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
    resilience = context.get(ResilienceService);
    const policy = new AddressPolicy(LOOPBACK);
    broker = new KafkaBroker(policy);
    client = clientOn(policy, broker);
    admin = new Admin({ clientId: "test", bootstrapBrokers: [bootstrap] });
    producer = new Producer({
      clientId: "test",
      bootstrapBrokers: [bootstrap],
      serializers: stringSerializers,
    });
  }, 240_000);

  afterAll(async () => {
    const closed = subscriptions.map((subscription) => subscription.close());
    await Promise.allSettled(closed);
    await broker.onApplicationShutdown();
    await producer.close();
    await admin.close();
    await context.close();
    await documents.close();
    await kafka.stop();
  });

  it("publishes_the_message_and_its_headers_to_the_topic_the_channel_names", async () => {
    await admin.createTopics({ topics: ["paid"], partitions: 1, replicas: 1 });
    served["paid.json"] = documentOf(bootstrap, "paid");
    const exchange: AsyncApiRequest["exchange"] = {
      kind: "publish",
      message: { payload: { order: 1 }, headers: { source: "tenon" } },
    };
    const request = requestOf("paid.json", exchange);

    const outcome = await client.publish(request, callContextOf("step-1"));
    const reader = new Consumer({
      clientId: "test",
      groupId: "test-reader",
      bootstrapBrokers: [bootstrap],
      deserializers: stringDeserializers,
    });
    const stream = await reader.consume({
      topics: ["paid"],
      mode: MessagesStreamModes.EARLIEST,
    });
    const read: { value: string; headers: Map<string, string> }[] = [];

    for await (const message of stream) {
      read.push(message);
      break;
    }

    await reader.close(true);

    expect(outcome).toEqual({ kind: "published" });
    expect(read[0]?.value).toBe('{"order":1}');
    expect(Object.fromEntries(read[0]?.headers ?? [])).toEqual({
      "content-type": "application/json",
      source: "tenon",
    });
  });

  it("a_receive_takes_the_messages_of_its_topic_in_order_from_when_it_joined", async () => {
    const request = await topicFor("received");
    await produced("received", '{"order":0}');
    const inbox: AsyncApiInboundMessage[] = [];
    await subscribed(request, "receiver-in-order", (message) => {
      inbox.push(message);
      return Promise.resolve();
    });
    await joined("received", inbox);

    await produced("received", '{"order":2}', { source: "shop" });
    await produced("received", "not json");
    await vi.waitFor(
      () => {
        expect(realOf(inbox)).toHaveLength(2);
      },
      { timeout: 10_000, interval: 50 },
    );

    expect(realOf(inbox)).toEqual([
      {
        payload: { order: 2 },
        headers: { source: "shop" },
        correlationId: null,
      },
      { payload: "not json", headers: {}, correlationId: null },
    ]);
  });

  it("a_message_whose_delivery_fails_is_not_committed_and_comes_again_to_the_next_subscription", async () => {
    const request = await topicFor("retried");
    let lostOnce: () => void = () => {};
    const lost = new Promise<void>((resolve) => {
      lostOnce = resolve;
    });
    const probes: AsyncApiInboundMessage[] = [];
    const refusing = (message: AsyncApiInboundMessage) => {
      if (!isProbe(message))
        return Promise.reject(new Error("The store is down"));

      probes.push(message);
      return Promise.resolve();
    };
    const first = await subscribed(
      request,
      "receiver-retried",
      refusing,
      () => {
        lostOnce();
      },
    );
    await joined("retried", probes);

    await produced("retried", '{"order":3}');
    await lost;
    await first.close();
    const inbox: AsyncApiInboundMessage[] = [];
    await subscribed(request, "receiver-retried", (message) => {
      inbox.push(message);
      return Promise.resolve();
    });
    await vi.waitFor(
      () => {
        expect(realOf(inbox)).toHaveLength(1);
      },
      { timeout: 30_000, interval: 50 },
    );

    expect(realOf(inbox).map((message) => message.payload)).toEqual([
      { order: 3 },
    ]);
  });

  it("a_cluster_that_advertises_a_broker_the_host_refuses_is_unreachable", async () => {
    expect(advertised).not.toBe(HOST);
    const policy = new AdvertisedNameRefused(advertised);
    const refusing = new KafkaBroker(policy);
    const guarded = clientOn(policy, refusing);
    await admin.createTopics({
      topics: ["guarded"],
      partitions: 1,
      replicas: 1,
    });
    served["guarded.json"] = documentOf(bootstrap, "guarded");
    const exchange: AsyncApiRequest["exchange"] = {
      kind: "publish",
      message: { payload: { order: 4 }, headers: {} },
    };
    const request = requestOf("guarded.json", exchange);

    const outcome = await guarded.publish(request, callContextOf("step-2"));
    await refusing.onApplicationShutdown();

    expect(outcome).toEqual({ kind: "unreachable", detail: REFUSED_ADDRESS });
  });
});
