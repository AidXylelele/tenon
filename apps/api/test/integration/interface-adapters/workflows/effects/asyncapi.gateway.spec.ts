import { type AddressInfo, createServer, type Socket } from "node:net";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule, ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import {
  connect as connectNats,
  headers as natsHeaders,
  type Msg,
  type NatsConnection as NatsClient,
} from "@nats-io/transport-node";
import {
  type Channel,
  type ChannelModel,
  connect as connectAmqp,
} from "amqplib";
import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  Failure,
  JsonObject,
} from "interpreter";
import { connectAsync, type MqttClient, type Packet } from "mqtt";
import { createClient, type RedisClientType } from "redis";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { AmqpConnection } from "../../../../../src/frameworks/amqp/amqp.connection.js";
import {
  resiliencePresets,
  responseSizeLimit,
} from "../../../../../src/frameworks/di/host.presets.js";
import { KafkaConnection } from "../../../../../src/frameworks/kafka/kafka.connection.js";
import { MqttConnection } from "../../../../../src/frameworks/mqtt/mqtt.connection.js";
import { NatsConnection } from "../../../../../src/frameworks/nats/nats.connection.js";
import { AddressPolicy } from "../../../../../src/frameworks/network/address-policy.js";
import { RedisConnection } from "../../../../../src/frameworks/redis/redis.connection.js";
import type { BrokerSubscription } from "../../../../../src/interface-adapters/messaging/interfaces.js";
import { AmqpChannel } from "../../../../../src/interface-adapters/workflows/effects/amqp.channel.js";
import { AsyncApiDocuments } from "../../../../../src/interface-adapters/workflows/effects/asyncapi-documents.js";
import { AsyncApiGateway } from "../../../../../src/interface-adapters/workflows/effects/asyncapi.gateway.js";
import { KafkaChannel } from "../../../../../src/interface-adapters/workflows/effects/kafka.channel.js";
import { MqttChannel } from "../../../../../src/interface-adapters/workflows/effects/mqtt.channel.js";
import { NatsChannel } from "../../../../../src/interface-adapters/workflows/effects/nats.channel.js";
import { RedisChannel } from "../../../../../src/interface-adapters/workflows/effects/redis.channel.js";
import {
  closedPort,
  startStubServer,
  type StubServer,
} from "../../../../support/stub-server.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  inboxOf,
  resourcesOf,
} from "../../../../support/outbound.js";

const HOST = "127.0.0.1";
const LOGIN = { kind: "basic", username: "ada", password: "lovelace" } as const;
const ANOTHER_LOGIN = {
  kind: "basic",
  username: "ada",
  password: "not-lovelace",
} as const;
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";

interface Received {
  readonly topic: string;
  readonly body: string;
  readonly headers: Readonly<Record<string, unknown>>;
}

function infoOf(title: string): JsonObject {
  return { title, version: "1.0.0" };
}

function v3Document(
  protocol: string,
  host: string,
  channel: JsonObject,
  bindings: JsonObject = {},
): JsonObject {
  return {
    asyncapi: "3.0.0",
    info: infoOf(`${protocol} orders`),
    servers: { broker: { host, protocol, protocolVersion: "5" } },
    channels: { orders: channel },
    operations: {
      announce: {
        action: "send",
        channel: { $ref: "#/channels/orders" },
        bindings,
      },
    },
  };
}

function eventuallyOne<T>(received: readonly T[]): Promise<T> {
  return vi.waitFor(
    () => {
      const [first] = received;

      if (first === undefined) throw new Error("Nothing was received yet");

      return first;
    },
    { timeout: 5_000, interval: 20 },
  );
}

describe("the AsyncAPI gateway publishing on the servers a document names", () => {
  let context: INestApplicationContext;
  let gateway: AsyncApiGateway;
  let connections: readonly { onApplicationShutdown(): Promise<void> }[];
  let documents: StubServer;
  let served: Record<string, JsonObject>;
  let mosquitto: StartedTestContainer;
  let nats: StartedTestContainer;
  let redis: StartedTestContainer;
  let rabbit: StartedTestContainer;

  const at = (container: StartedTestContainer, port: number) =>
    `${HOST}:${String(container.getMappedPort(port))}`;

  const requestOf = (
    name: string,
    target: { readonly operation?: string; readonly channel?: string },
    message: AsyncApiRequest["exchange"],
    authentication: AsyncApiRequest["authentication"] = null,
    server: AsyncApiRequest["server"] = null,
  ): AsyncApiRequest => ({
    kind: "asyncapi",
    document: {
      name: null,
      endpoint: { uri: `${documents.origin}/${name}`, authentication: null },
    },
    authentication,
    operation: target.operation ?? null,
    channel: target.channel ?? null,
    server,
    protocol: null,
    exchange: message,
  });

  const published = (
    payload: JsonObject,
    headers: JsonObject = {},
  ): AsyncApiRequest["exchange"] => ({
    kind: "publish",
    message: { payload, headers },
  });

  beforeAll(async () => {
    const started = await Promise.all([
      new GenericContainer("eclipse-mosquitto:2.0.22")
        .withCommand(["mosquitto", "-c", "/mosquitto-no-auth.conf"])
        .withExposedPorts(1883)
        .withWaitStrategy(Wait.forLogMessage(/mosquitto version .* running/))
        .start(),
      new GenericContainer("nats:2.12.2-alpine")
        .withCommand(["--user", "ada", "--pass", "lovelace"])
        .withExposedPorts(4222)
        .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
        .start(),
      new GenericContainer("redis:7")
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
        .start(),
      new GenericContainer("rabbitmq:4.2-alpine")
        .withEnvironment({
          RABBITMQ_DEFAULT_USER: "ada",
          RABBITMQ_DEFAULT_PASS: "lovelace",
        })
        .withExposedPorts(5672)
        .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
        .withStartupTimeout(90_000)
        .start(),
    ]);
    [mosquitto, nats, redis, rabbit] = started;
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
    const resources = resourcesOf(policy, resilience);
    const authentication = authenticationOf(fetchClientOf(policy.dispatcher));
    const amqp = new AmqpConnection(policy);
    const kafka = new KafkaConnection(policy);
    const mqtt = new MqttConnection(policy);
    const natsConnection = new NatsConnection(policy);
    const redisConnection = new RedisConnection(policy);
    connections = [amqp, kafka, mqtt, natsConnection, redisConnection];
    gateway = new AsyncApiGateway(
      resources,
      authentication,
      new AsyncApiDocuments(),
      responseSizeLimit,
      new AmqpChannel(amqp),
      new KafkaChannel(kafka),
      new MqttChannel(mqtt),
      new NatsChannel(natsConnection),
      new RedisChannel(redisConnection),
      resilience,
    );
  }, 180_000);

  afterAll(async () => {
    await Promise.all(
      connections.map((connection) => connection.onApplicationShutdown()),
    );
    await context.close();
    await documents.close();
    await Promise.all(
      [mosquitto, nats, redis, rabbit].map((container) => container.stop()),
    );
  });

  describe("on MQTT", () => {
    let subscriber: MqttClient;
    const received: Received[] = [];

    beforeAll(async () => {
      subscriber = await connectAsync(`mqtt://${at(mosquitto, 1883)}`, {
        protocolVersion: 5,
      });
      subscriber.on(
        "message",
        (topic: string, body: Buffer, packet: Packet) => {
          const properties =
            packet.cmd === "publish" ? packet.properties?.userProperties : {};
          received.push({
            topic,
            body: body.toString(),
            headers: properties ?? {},
          });
        },
      );
      await subscriber.subscribeAsync("orders/#", { qos: 1 });
    });

    afterAll(async () => {
      await subscriber.endAsync();
    });

    it("publishes_the_message_and_its_headers_to_the_topic_the_operation_names", async () => {
      served["mqtt.json"] = v3Document(
        "mqtt",
        at(mosquitto, 1883),
        {
          address: "orders/paid",
          messages: { paid: { contentType: "application/json", payload: {} } },
        },
        { mqtt: { qos: 1 } },
      );
      const request = requestOf(
        "mqtt.json",
        { operation: "announce" },
        published({ order: 7 }, { source: "tenon" }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-1"));
      const message = await eventuallyOne(received);

      expect(outcome).toEqual({ kind: "published" });
      expect(message).toEqual({
        topic: "orders/paid",
        body: '{"order":7}',
        headers: { source: "tenon" },
      });
    });
  });

  describe("on NATS", () => {
    let subscriber: NatsClient;
    const received: Received[] = [];

    beforeAll(async () => {
      subscriber = await connectNats({
        servers: at(nats, 4222),
        user: "ada",
        pass: "lovelace",
      });
      subscriber.subscribe("orders.paid", {
        callback: (_error: unknown, message: Msg) => {
          const headers = Object.fromEntries(
            Array.from(message.headers?.keys() ?? []).map((name) => [
              name,
              message.headers?.get(name),
            ]),
          );
          received.push({
            topic: message.subject,
            body: message.string(),
            headers,
          });
        },
      });
      await subscriber.flush();
    });

    afterAll(async () => {
      await subscriber.close();
    });

    it("publishes_to_the_subject_a_version_2_channel_names_keyed_by_the_step", async () => {
      served["nats.json"] = {
        asyncapi: "2.6.0",
        info: infoOf("nats orders"),
        servers: { broker: { url: at(nats, 4222), protocol: "nats" } },
        channels: { "orders.paid": { publish: { message: { payload: {} } } } },
      };
      const request = requestOf(
        "nats.json",
        { channel: "orders.paid" },
        published({ order: 8 }),
        LOGIN,
      );

      const outcome = await gateway.perform(request, callContextOf("step-2"));
      const message = await eventuallyOne(received);

      expect(outcome).toEqual({ kind: "published" });
      expect(message).toEqual({
        topic: "orders.paid",
        body: '{"order":8}',
        headers: { "Nats-Msg-Id": "step-2" },
      });
    });

    it("a_login_the_broker_refuses_is_unauthenticated", async () => {
      const request = requestOf(
        "nats.json",
        { channel: "orders.paid" },
        published({ order: 9 }),
        ANOTHER_LOGIN,
      );

      const outcome = await gateway.perform(request, callContextOf("step-3"));

      expect(outcome).toMatchObject({ kind: "unauthenticated" });
    });
  });

  describe("on Redis", () => {
    let subscriber: RedisClientType;
    const received: Received[] = [];

    beforeAll(async () => {
      subscriber = createClient({ url: `redis://${at(redis, 6379)}` });
      await subscriber.connect();
      await subscriber.subscribe("orders", (body: string, topic: string) => {
        received.push({ topic, body, headers: {} });
      });
    });

    afterAll(async () => {
      await subscriber.close();
    });

    it("publishes_to_the_channel_and_refuses_headers_redis_cannot_carry", async () => {
      served["redis.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders",
      });
      const plain = requestOf(
        "redis.json",
        { operation: "announce" },
        published({ order: 10 }),
      );
      const headed = requestOf(
        "redis.json",
        { operation: "announce" },
        published({ order: 11 }, { source: "tenon" }),
      );

      const outcome = await gateway.perform(plain, callContextOf("step-4"));
      const refused = await gateway.perform(headed, callContextOf("step-5"));
      const message = await eventuallyOne(received);

      expect(outcome).toEqual({ kind: "published" });
      expect(message).toEqual({
        topic: "orders",
        body: '{"order":10}',
        headers: {},
      });
      expect(refused).toMatchObject({ kind: "misconfigured" });
    });
  });

  describe("on AMQP", () => {
    let model: ChannelModel;
    let channel: Channel;

    beforeAll(async () => {
      model = await connectAmqp(`amqp://ada:lovelace@${at(rabbit, 5672)}`);
      channel = await model.createChannel();
      await channel.assertQueue("orders");
    });

    afterAll(async () => {
      await model.close();
    });

    it("publishes_to_the_queue_the_binding_names_as_a_persistent_message_keyed_by_the_step", async () => {
      served["amqp.json"] = v3Document("amqp", at(rabbit, 5672), {
        address: "orders",
        bindings: { amqp: { is: "queue", queue: { name: "orders" } } },
      });
      const request = requestOf(
        "amqp.json",
        { operation: "announce" },
        published({ order: 12 }, { source: "tenon" }),
        LOGIN,
      );

      const outcome = await gateway.perform(request, callContextOf("step-6"));
      const message = await vi.waitFor(
        async () => {
          const got = await channel.get("orders", { noAck: true });

          if (got === false) throw new Error("The queue is empty");

          return got;
        },
        { timeout: 5_000, interval: 50 },
      );

      expect(outcome).toEqual({ kind: "published" });
      expect(message.content.toString()).toBe('{"order":12}');
      expect(message.properties).toMatchObject({
        messageId: "step-6",
        contentType: "application/json",
        deliveryMode: 2,
        headers: { source: "tenon" },
      });
    });

    it("a_login_the_broker_refuses_is_unauthenticated", async () => {
      const request = requestOf(
        "amqp.json",
        { operation: "announce" },
        published({ order: 13 }),
        ANOTHER_LOGIN,
      );

      const outcome = await gateway.perform(request, callContextOf("step-7"));

      expect(outcome).toMatchObject({ kind: "unauthenticated" });
    });
  });

  describe("the server, the document and the host's rules", () => {
    it("a_named_server_takes_the_variables_the_call_gives", async () => {
      served["variables.json"] = {
        asyncapi: "3.0.0",
        info: infoOf("variables"),
        servers: {
          broker: {
            host: `${HOST}:{port}`,
            protocol: "redis",
            variables: { port: { default: "1" } },
          },
        },
        channels: { orders: { address: "orders" } },
        operations: {
          announce: { action: "send", channel: { $ref: "#/channels/orders" } },
        },
      };
      const port = String(redis.getMappedPort(6379));
      const request = requestOf(
        "variables.json",
        { operation: "announce" },
        published({ order: 14 }),
        null,
        { name: "broker", variables: { port } },
      );

      const outcome = await gateway.perform(request, callContextOf("step-8"));

      expect(outcome).toEqual({ kind: "published" });
    });

    it("a_broker_on_an_address_not_allow_listed_is_unreachable_and_never_dialled", async () => {
      served["private.json"] = v3Document("mqtt", "10.0.0.1:1883", {
        address: "orders/paid",
      });
      const request = requestOf(
        "private.json",
        { operation: "announce" },
        published({ order: 15 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-9"));

      expect(outcome).toEqual({ kind: "unreachable", detail: REFUSED_ADDRESS });
    });

    it("a_broker_that_does_not_answer_is_unreachable", async () => {
      const port = String(await closedPort());
      served["closed.json"] = v3Document("nats", `${HOST}:${port}`, {
        address: "orders",
      });
      const request = requestOf(
        "closed.json",
        { operation: "announce" },
        published({ order: 16 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-10"));

      expect(outcome).toMatchObject({ kind: "unreachable" });
    });

    describe("a broker that accepts a connection and never answers", () => {
      const dialled: Socket[] = [];
      const silent = createServer((socket) => {
        dialled.push(socket);
      });

      beforeAll(async () => {
        await new Promise<void>((resolve) => {
          silent.listen(0, HOST, resolve);
        });
        const port = String((silent.address() as AddressInfo).port);

        for (const protocol of ["amqp", "mqtt", "nats", "redis"])
          served[`silent-${protocol}.json`] = v3Document(
            protocol,
            `${HOST}:${port}`,
            { address: "orders" },
          );
      });

      afterAll(async () => {
        for (const socket of dialled) socket.destroy();

        await new Promise((resolve) => silent.close(resolve));
      });

      it("is_unreachable_once_the_connect_times_out_and_is_dialled_anew_by_the_next_call", async () => {
        const requestOn = (protocol: string) =>
          requestOf(
            `silent-${protocol}.json`,
            { operation: "announce" },
            published({ order: 21 }),
          );
        const stopped = new AbortController();
        const stoppedCall = {
          ...callContextOf("step-17"),
          signal: stopped.signal,
        };
        const protocols = ["amqp", "mqtt", "nats", "redis"];
        const publishing = protocols.map((protocol) =>
          gateway.perform(
            requestOn(protocol),
            callContextOf(`step-${protocol}`),
          ),
        );

        const outcomes = await Promise.all(publishing);
        const next = gateway.perform(requestOn("amqp"), stoppedCall);
        await vi.waitFor(
          () => {
            expect(dialled).toHaveLength(protocols.length + 1);
          },
          { timeout: 5_000, interval: 20 },
        );
        stopped.abort();

        expect(outcomes.map((outcome) => outcome.kind)).toEqual([
          "unreachable",
          "unreachable",
          "unreachable",
          "unreachable",
        ]);
        expect(outcomes[0]).toEqual({
          kind: "unreachable",
          detail: "connect ETIMEDOUT",
        });
        await expect(next).resolves.toEqual({ kind: "expired" });
      });

      it("a_receive_that_ends_before_the_broker_answers_is_expired_at_once", async () => {
        const receive: AsyncApiRequest["exchange"] = {
          kind: "receive",
          subscription: "/do/0/orders",
          position: 0,
          closesAt: null,
        };
        const request = requestOf(
          "silent-amqp.json",
          { channel: "orders" },
          receive,
        );
        const ended = new AbortController();
        const deliver = () => Promise.resolve();
        const inbox = { ...inboxOf(deliver), ended: ended.signal };
        const dials = dialled.length;

        const subscribed = gateway.subscribe(
          request,
          callContextOf("receiver-silent"),
          inbox,
        );
        await vi.waitFor(
          () => {
            expect(dialled).toHaveLength(dials + 1);
          },
          { timeout: 5_000, interval: 20 },
        );
        ended.abort();

        await expect(subscribed).resolves.toEqual({ kind: "expired" });
      });
    });

    it("an_external_reference_of_the_document_is_never_read", async () => {
      served["external.json"] = {
        ...v3Document("redis", at(redis, 6379), { address: "orders" }),
        components: {
          messages: { paid: { $ref: `${documents.origin}/message.json` } },
        },
      };
      served["message.json"] = { payload: {} };
      const request = requestOf(
        "external.json",
        { operation: "announce" },
        published({ order: 17 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-11"));
      const read = documents.received.map((received) => received.url);

      expect(outcome).toMatchObject({ kind: "misconfigured" });
      expect(read).not.toContain("/message.json");
    });

    it("an_operation_the_document_lacks_is_misconfigured", async () => {
      served["lacking.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders",
      });
      const request = requestOf(
        "lacking.json",
        { operation: "missing" },
        published({ order: 18 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-12"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The document has no such operation or channel",
      });
    });

    it("a_protocol_the_host_does_not_publish_over_is_misconfigured", async () => {
      served["stomp.json"] = v3Document("stomp", `${HOST}:61613`, {
        address: "orders",
      });
      const request = requestOf(
        "stomp.json",
        { operation: "announce" },
        published({ order: 19 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-13"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The host does not publish over the protocol 'stomp'",
      });
    });

    it("a_broker_login_other_than_basic_is_misconfigured", async () => {
      served["bearer.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders",
      });
      const request = requestOf(
        "bearer.json",
        { operation: "announce" },
        published({ order: 22 }),
        { kind: "bearer", token: "t-1" },
      );

      const outcome = await gateway.perform(request, callContextOf("step-20"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "A broker is authenticated with basic credentials only",
      });
    });

    it("a_message_larger_than_the_host_takes_is_misconfigured_and_never_sent", async () => {
      served["large.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders",
      });
      const text = "x".repeat(responseSizeLimit.bytes);
      const request = requestOf(
        "large.json",
        { operation: "announce" },
        published({ text }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-21"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The message is larger than the host's 1 MiB",
      });
    });

    it("headers_on_mqtt_3_1_1_are_misconfigured", async () => {
      served["mqtt-3.json"] = {
        asyncapi: "3.0.0",
        info: infoOf("mqtt 3.1.1 orders"),
        servers: {
          broker: {
            host: at(mosquitto, 1883),
            protocol: "mqtt",
            protocolVersion: "3.1.1",
          },
        },
        channels: { orders: { address: "orders/paid" } },
      };
      const request = requestOf(
        "mqtt-3.json",
        { channel: "orders" },
        published({ order: 23 }, { source: "tenon" }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-22"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "MQTT 3.1.1 carries no headers; name protocolVersion 5",
      });
    });

    it("a_kafka_binding_the_host_cannot_read_is_misconfigured", async () => {
      served["kafka-binding.json"] = v3Document("kafka", `${HOST}:9092`, {
        address: "orders",
        bindings: { kafka: { topic: "" } },
      });
      const request = requestOf(
        "kafka-binding.json",
        { operation: "announce" },
        published({ order: 24 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-23"));

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The channel's kafka binding is not one the host reads",
      });
    });

    it("a_document_the_host_cannot_read_is_rejected_with_its_status", async () => {
      const request = requestOf(
        "nowhere.json",
        { operation: "announce" },
        published({ order: 20 }),
      );

      const outcome = await gateway.perform(request, callContextOf("step-14"));

      expect(outcome).toMatchObject({ kind: "rejected", statusCode: 404 });
    });

    it("a_receive_is_a_wait_of_the_run_and_never_a_call", async () => {
      const request = requestOf(
        "redis.json",
        { operation: "announce" },
        {
          kind: "receive",
          subscription: "/do/0/orders",
          position: 0,
          closesAt: null,
        },
      );

      const outcome = gateway.perform(request, callContextOf("step-15"));

      await expect(outcome).rejects.toThrow(
        "A receive is a wait of the run that the host's receivers answer",
      );
    });
  });
  describe("receiving the messages of a subscription", () => {
    const receive: AsyncApiRequest["exchange"] = {
      kind: "receive",
      subscription: "/do/0/orders",
      position: 0,
      closesAt: null,
    };
    const subscriptions: BrokerSubscription[] = [];

    const subscribed = async (
      request: AsyncApiRequest,
      deliver: (message: AsyncApiInboundMessage) => Promise<void>,
      lost: () => void = () => {},
    ) => {
      const call = callContextOf("receiver-1");
      const inbox = inboxOf(deliver, lost);
      const outcome = await gateway.subscribe(request, call, inbox);

      if (outcome.kind !== "subscribed")
        throw new Error(`The gateway did not subscribe: ${outcome.kind}`);

      subscriptions.push(outcome.subscription);
      return outcome.subscription;
    };

    const collectedIn = (inbox: AsyncApiInboundMessage[]) => {
      return (message: AsyncApiInboundMessage) => {
        inbox.push(message);
        return Promise.resolve();
      };
    };

    const twoOf = (inbox: readonly AsyncApiInboundMessage[]) =>
      vi.waitFor(
        () => {
          expect(inbox).toHaveLength(2);
        },
        { timeout: 5_000, interval: 20 },
      );

    afterAll(async () => {
      const closed = subscriptions.map((subscription) => subscription.close());
      await Promise.allSettled(closed);
    });

    it("an_mqtt_receive_takes_the_messages_of_its_topic_in_order_with_their_properties", async () => {
      served["mqtt-in.json"] = v3Document("mqtt", at(mosquitto, 1883), {
        address: "orders/received",
        messages: { paid: { contentType: "application/json", payload: {} } },
      });
      const inbox: AsyncApiInboundMessage[] = [];
      const request = requestOf("mqtt-in.json", { channel: "orders" }, receive);
      await subscribed(request, collectedIn(inbox));
      const publisher = await connectAsync(`mqtt://${at(mosquitto, 1883)}`, {
        protocolVersion: 5,
      });
      const properties = {
        contentType: "application/json",
        userProperties: { source: "shop" },
        correlationData: Buffer.from("c-1"),
      };

      await publisher.publishAsync("orders/received", '{"order":1}', {
        qos: 1,
        properties,
      });
      await publisher.publishAsync("orders/received", '{"order":2}', {
        qos: 1,
      });
      await publisher.endAsync();
      await twoOf(inbox);

      expect(inbox).toEqual([
        {
          payload: { order: 1 },
          headers: { source: "shop" },
          correlationId: "c-1",
        },
        { payload: { order: 2 }, headers: {}, correlationId: null },
      ]);
    });

    it("a_nats_receive_takes_the_messages_of_its_subject_with_their_headers", async () => {
      served["nats-in.json"] = v3Document("nats", at(nats, 4222), {
        address: "orders.received",
      });
      const inbox: AsyncApiInboundMessage[] = [];
      const request = requestOf(
        "nats-in.json",
        { channel: "orders" },
        receive,
        LOGIN,
      );
      await subscribed(request, collectedIn(inbox));
      const publisher = await connectNats({
        servers: at(nats, 4222),
        user: "ada",
        pass: "lovelace",
      });
      const sent = natsHeaders();
      sent.set("source", "shop");

      publisher.publish("orders.received", '{"order":3}', { headers: sent });
      publisher.publish("orders.received", "not json");
      await publisher.flush();
      await publisher.close();
      await twoOf(inbox);

      expect(inbox).toEqual([
        {
          payload: { order: 3 },
          headers: { source: "shop" },
          correlationId: null,
        },
        { payload: "not json", headers: {}, correlationId: null },
      ]);
    });

    it("a_redis_receive_takes_the_messages_of_its_channel", async () => {
      served["redis-in.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders-in",
      });
      const inbox: AsyncApiInboundMessage[] = [];
      const request = requestOf(
        "redis-in.json",
        { channel: "orders" },
        receive,
      );
      await subscribed(request, collectedIn(inbox));
      const publisher = createClient({ url: `redis://${at(redis, 6379)}` });
      await publisher.connect();

      await publisher.publish("orders-in", '{"order":4}');
      await publisher.publish("orders-in", '{"order":5}');
      await publisher.close();
      await twoOf(inbox);

      expect(inbox).toEqual([
        { payload: { order: 4 }, headers: {}, correlationId: null },
        { payload: { order: 5 }, headers: {}, correlationId: null },
      ]);
    });

    it("a_received_message_larger_than_the_host_takes_fails_the_receive", async () => {
      served["redis-large.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders-large",
      });
      const failures: Failure[] = [];
      const inbox = {
        ...inboxOf(() => Promise.resolve()),
        failure: (failure: Failure) => {
          failures.push(failure);
          return Promise.resolve();
        },
      };
      const request = requestOf(
        "redis-large.json",
        { channel: "orders" },
        receive,
      );
      const outcome = await gateway.subscribe(
        request,
        callContextOf("receiver-large"),
        inbox,
      );

      if (outcome.kind !== "subscribed")
        throw new Error(`The gateway did not subscribe: ${outcome.kind}`);

      subscriptions.push(outcome.subscription);
      const publisher = createClient({ url: `redis://${at(redis, 6379)}` });
      await publisher.connect();
      const large = "x".repeat(responseSizeLimit.bytes + 1);

      await publisher.publish("orders-large", large);
      await publisher.close();
      await vi.waitFor(
        () => {
          expect(failures).toHaveLength(1);
        },
        { timeout: 5_000, interval: 20 },
      );

      expect(failures).toEqual([
        {
          kind: "misconfigured",
          detail: "A received message is larger than the host's 1 MiB",
        },
      ]);
    });

    it("a_redis_receive_keeps_its_messages_coming_after_the_broker_drops_its_connection", async () => {
      served["redis-kept.json"] = v3Document("redis", at(redis, 6379), {
        address: "orders-kept",
      });
      const inbox: AsyncApiInboundMessage[] = [];
      const lost = vi.fn();
      const request = requestOf(
        "redis-kept.json",
        { channel: "orders" },
        receive,
      );
      await subscribed(request, collectedIn(inbox), lost);
      const broker = createClient({ url: `redis://${at(redis, 6379)}` });
      await broker.connect();

      const killed = await broker.sendCommand([
        "CLIENT",
        "KILL",
        "TYPE",
        "pubsub",
      ]);
      await vi.waitFor(
        async () => {
          const counts = await broker.pubSubNumSub("orders-kept");
          expect(counts["orders-kept"]).toBe(1);
        },
        { timeout: 10_000, interval: 100 },
      );
      await broker.publish("orders-kept", '{"order":6}');
      await broker.publish("orders-kept", '{"order":7}');
      await broker.close();
      await twoOf(inbox);

      expect(inbox.map((message) => message.payload)).toEqual([
        { order: 6 },
        { order: 7 },
      ]);
      expect(killed).toBeGreaterThan(0);
      expect(lost).not.toHaveBeenCalled();
    });

    describe("on AMQP", () => {
      let model: ChannelModel;
      let channel: Channel;

      beforeAll(async () => {
        model = await connectAmqp(`amqp://ada:lovelace@${at(rabbit, 5672)}`);
        channel = await model.createChannel();
        await channel.assertQueue("orders-in");
        await channel.assertExchange("orders.topic", "topic");
      });

      afterAll(async () => {
        await model.close();
      });

      it("a_receive_takes_the_messages_of_the_queue_the_binding_names_with_their_properties", async () => {
        served["amqp-in.json"] = v3Document("amqp", at(rabbit, 5672), {
          address: "orders-in",
          bindings: { amqp: { is: "queue", queue: { name: "orders-in" } } },
        });
        const inbox: AsyncApiInboundMessage[] = [];
        const request = requestOf(
          "amqp-in.json",
          { channel: "orders" },
          receive,
          LOGIN,
        );
        await subscribed(request, collectedIn(inbox));
        const first = Buffer.from('{"order":6}');
        const second = Buffer.from('{"order":7}');

        channel.sendToQueue("orders-in", first, {
          contentType: "application/json",
          correlationId: "c-6",
          headers: { source: "shop" },
        });
        channel.sendToQueue("orders-in", second);
        await twoOf(inbox);

        expect(inbox).toEqual([
          {
            payload: { order: 6 },
            headers: { source: "shop" },
            correlationId: "c-6",
          },
          { payload: { order: 7 }, headers: {}, correlationId: null },
        ]);
      });

      it("a_routing_key_binding_takes_what_the_exchange_routes_by_the_channel_address", async () => {
        served["amqp-routed.json"] = v3Document("amqp", at(rabbit, 5672), {
          address: "orders.paid",
          bindings: {
            amqp: { is: "routingKey", exchange: { name: "orders.topic" } },
          },
        });
        const inbox: AsyncApiInboundMessage[] = [];
        const request = requestOf(
          "amqp-routed.json",
          { channel: "orders" },
          receive,
          LOGIN,
        );
        await subscribed(request, collectedIn(inbox));
        const paid = Buffer.from('{"order":8}');
        const shipped = Buffer.from('{"order":9}');
        const later = Buffer.from('{"order":10}');

        channel.publish("orders.topic", "orders.paid", paid);
        channel.publish("orders.topic", "orders.shipped", shipped);
        channel.publish("orders.topic", "orders.paid", later);
        await twoOf(inbox);

        expect(inbox.map((message) => message.payload)).toEqual([
          { order: 8 },
          { order: 10 },
        ]);
      });

      it("a_message_whose_delivery_fails_is_given_again_before_the_next", async () => {
        await channel.assertQueue("orders-retried");
        served["amqp-retried.json"] = v3Document("amqp", at(rabbit, 5672), {
          address: "orders-retried",
          bindings: {
            amqp: { is: "queue", queue: { name: "orders-retried" } },
          },
        });
        const inbox: AsyncApiInboundMessage[] = [];
        let refusals = 1;
        const deliver = (message: AsyncApiInboundMessage) => {
          if (refusals > 0) {
            refusals -= 1;
            return Promise.reject(new Error("The store is down"));
          }

          inbox.push(message);
          return Promise.resolve();
        };
        const request = requestOf(
          "amqp-retried.json",
          { channel: "orders" },
          receive,
          LOGIN,
        );
        await subscribed(request, deliver);
        const first = Buffer.from('{"order":11}');
        const second = Buffer.from('{"order":12}');

        channel.sendToQueue("orders-retried", first);
        channel.sendToQueue("orders-retried", second);
        await twoOf(inbox);

        expect(inbox.map((message) => message.payload)).toEqual([
          { order: 11 },
          { order: 12 },
        ]);
      });

      it("a_receive_and_a_publisher_recover_after_the_broker_closes_their_connections", async () => {
        await channel.assertQueue("orders-kept");
        served["amqp-kept.json"] = v3Document("amqp", at(rabbit, 5672), {
          address: "orders-kept",
          bindings: { amqp: { is: "queue", queue: { name: "orders-kept" } } },
        });
        const inbox: AsyncApiInboundMessage[] = [];
        const lost = vi.fn();
        const receiving = requestOf(
          "amqp-kept.json",
          { channel: "orders" },
          receive,
          LOGIN,
        );
        const publishing = requestOf(
          "amqp-kept.json",
          { operation: "announce" },
          published({ order: 13 }),
          LOGIN,
        );
        await subscribed(receiving, collectedIn(inbox), lost);
        const before = await gateway.perform(
          publishing,
          callContextOf("step-18"),
        );
        await vi.waitFor(
          () => {
            expect(inbox).toHaveLength(1);
          },
          { timeout: 5_000, interval: 20 },
        );
        model.on("error", () => undefined);

        await rabbit.exec(["rabbitmqctl", "close_all_connections", "test"]);
        model = await connectAmqp(`amqp://ada:lovelace@${at(rabbit, 5672)}`);
        channel = await model.createChannel();
        await vi.waitFor(
          async () => {
            const queue = await channel.checkQueue("orders-kept");
            expect(queue.consumerCount).toBe(1);
          },
          { timeout: 10_000, interval: 100 },
        );
        const republishing = requestOf(
          "amqp-kept.json",
          { operation: "announce" },
          published({ order: 14 }),
          LOGIN,
        );
        const after = await vi.waitFor(
          async () => {
            const outcome = await gateway.perform(
              republishing,
              callContextOf("step-19"),
            );
            expect(outcome).toEqual({ kind: "published" });
            return outcome;
          },
          { timeout: 10_000, interval: 100 },
        );
        await twoOf(inbox);

        expect(before).toEqual({ kind: "published" });
        expect(after).toEqual({ kind: "published" });
        expect(inbox.map((message) => message.payload)).toEqual([
          { order: 13 },
          { order: 14 },
        ]);
        expect(lost).not.toHaveBeenCalled();
      });
    });
  });
});
