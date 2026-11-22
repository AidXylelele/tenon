import {
  type Channel,
  type ChannelModel,
  connect as connectAmqp,
} from "amqplib";
import { createClient, type RedisClientType } from "redis";
import request from "supertest";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { AsyncApiHandler } from "../../../src/interface-adapters/messaging/asyncapi.handler.js";
import { RunController } from "../../../src/interface-adapters/workflows/run.controller.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  createRunApp,
  drain,
  instanceOf,
  publish,
  relay,
  resetRuns,
  start,
} from "../../support/run-helpers.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";

describe("a run that publishes and receives on a server its AsyncAPI document names", () => {
  let t: TestApp;
  let redis: StartedTestContainer;
  let rabbit: StartedTestContainer;
  let model: ChannelModel;
  let channel: Channel;
  let subscriber: RedisClientType;
  let producer: RedisClientType;
  let documents: StubServer;
  let editor: Record<string, string>;
  const received: string[] = [];

  beforeAll(async () => {
    [redis, rabbit] = await Promise.all([
      new GenericContainer("redis:7")
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
        .start(),
      new GenericContainer("rabbitmq:4.2-alpine")
        .withEnvironment({
          RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: "-rabbit loopback_users []",
        })
        .withExposedPorts(5672)
        .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
        .withStartupTimeout(90_000)
        .start(),
    ]);
    const queues = `127.0.0.1:${String(rabbit.getMappedPort(5672))}`;
    model = await connectAmqp(`amqp://guest:guest@${queues}`);
    channel = await model.createChannel();
    const broker = `127.0.0.1:${String(redis.getMappedPort(6379))}`;
    subscriber = createClient({ url: `redis://${broker}` });
    await subscriber.connect();
    await subscriber.subscribe("orders", (body: string) => {
      received.push(body);
    });
    producer = createClient({ url: `redis://${broker}` });
    await producer.connect();
    const document = {
      asyncapi: "3.0.0",
      info: { title: "orders", version: "1.0.0" },
      servers: { broker: { host: broker, protocol: "redis" } },
      channels: {
        orders: { address: "orders" },
        inbox: { address: "orders-in" },
      },
      operations: {
        announce: { action: "send", channel: { $ref: "#/channels/orders" } },
      },
    };
    const work = {
      asyncapi: "3.0.0",
      info: { title: "work", version: "1.0.0" },
      servers: { broker: { host: queues, protocol: "amqp" } },
      channels: {
        work: {
          address: "work",
          bindings: { amqp: { is: "queue", queue: { name: "work" } } },
        },
      },
    };
    documents = await startStubServer((request, response) => {
      const served = request.url === "/amqp.json" ? work : document;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(served));
    });
    const run = await createRunApp();
    t = run.t;
  }, 120_000);

  afterAll(async () => {
    await t.close();
    await subscriber.close();
    await producer.close();
    await documents.close();
    await model.close();
    await Promise.all([redis.stop(), rabbit.stop()]);
  });

  beforeEach(async () => {
    await resetRuns(t);
    received.length = 0;
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
  });

  it("publishes_the_message_its_call_builds_and_completes", async () => {
    const workflow = aDocument({ name: "announcer" }, [
      {
        announce: {
          call: "asyncapi",
          with: {
            document: { endpoint: `${documents.origin}/asyncapi.json` },
            operation: "announce",
            message: { payload: { order: "${ $workflow.input.order }" } },
          },
        },
      },
    ]);
    await publish(t, editor, workflow);

    const started = await start(
      t,
      editor,
      { input: { order: 21 } },
      "sales/announcer",
    );
    await drain(t);
    const ended = await instanceOf(t, editor, started.id);

    expect(ended.phase).toBe("completed");
    await vi.waitFor(() => {
      expect(received).toEqual(['{"order":21}']);
    });
  });

  it("receives_the_messages_its_subscription_consumes_in_order_and_completes", async () => {
    const workflow = aDocument({ name: "collector" }, [
      {
        collect: {
          call: "asyncapi",
          with: {
            document: { endpoint: `${documents.origin}/asyncapi.json` },
            channel: "inbox",
            subscription: { consume: { amount: 2 } },
          },
        },
      },
    ]);
    await publish(t, editor, workflow);
    const started = await start(t, editor, { input: {} }, "sales/collector");
    await drain(t);
    const receivers = t.app.get(AsyncApiHandler);

    await vi.waitFor(
      async () => {
        await receivers.sync();
        const counts = await producer.pubSubNumSub("orders-in");
        expect(counts["orders-in"]).toBe(1);
      },
      { timeout: 10_000, interval: 100 },
    );
    await producer.publish("orders-in", '{"order":1}');
    await producer.publish("orders-in", '{"order":2}');
    const ended = await vi.waitFor(
      async () => {
        await drain(t);
        const instance = await instanceOf(t, editor, started.id);
        expect(instance.phase).toBe("completed");
        return instance;
      },
      { timeout: 10_000, interval: 100 },
    );

    expect(ended.output).toEqual([
      { payload: { order: 1 }, headers: {}, correlationId: null },
      { payload: { order: 2 }, headers: {}, correlationId: null },
    ]);
    await vi.waitFor(async () => {
      await receivers.sync();
      const counts = await producer.pubSubNumSub("orders-in");
      expect(counts["orders-in"]).toBe(0);
    });
  });

  it("a_message_for_a_receive_that_has_closed_takes_no_wake_from_the_writer_after_it", async () => {
    const workflow = aDocument({ name: "approver" }, [
      {
        collect: {
          call: "asyncapi",
          with: {
            document: { endpoint: `${documents.origin}/asyncapi.json` },
            channel: "inbox",
            subscription: { consume: { amount: 1 } },
          },
        },
      },
      { approve: { listen: { to: { one: { with: { type: "approved" } } } } } },
      {
        confirm: {
          call: "http",
          with: {
            method: "get",
            endpoint: `${documents.origin}/asyncapi.json`,
          },
        },
      },
    ]);
    await publish(t, editor, workflow);
    const started = await start(t, editor, { input: {} }, "sales/approver");
    await drain(t);
    const receivers = t.app.get(AsyncApiHandler);
    await vi.waitFor(
      async () => {
        await receivers.sync();
        const counts = await producer.pubSubNumSub("orders-in");
        expect(counts["orders-in"]).toBe(1);
      },
      { timeout: 10_000, interval: 100 },
    );
    await producer.publish("orders-in", '{"order":1}');
    await vi.waitFor(
      async () => {
        await drain(t);
        const instance = await instanceOf(t, editor, started.id);
        expect(instance.waits).toMatchObject([{ kind: "event" }]);
      },
      { timeout: 10_000, interval: 100 },
    );
    const late = { payload: { order: 2 }, headers: {}, correlationId: null };

    await t.app
      .get(RunController)
      .receive(started.id, "/do/0/collect", late, 0)
      .catch(() => undefined);
    await drain(t);
    await request(t.server)
      .post("/api/v1/events")
      .set(editor)
      .set("content-type", "application/cloudevents+json")
      .send(
        JSON.stringify({
          specversion: "1.0",
          id: "approval-1",
          source: "/desk",
          type: "approved",
          data: {},
        }),
      )
      .expect(202);
    await relay(t);
    await drain(t);
    const ended = await instanceOf(t, editor, started.id);

    expect(ended.phase).toBe("completed");
  });

  it("a_receive_whose_document_lacks_its_channel_faults_its_task_and_is_not_retried", async () => {
    const workflow = aDocument({ name: "misdirected" }, [
      {
        collect: {
          call: "asyncapi",
          with: {
            document: { endpoint: `${documents.origin}/asyncapi.json` },
            channel: "missing",
            subscription: { consume: { amount: 1 } },
          },
        },
      },
    ]);
    await publish(t, editor, workflow);
    const started = await start(t, editor, { input: {} }, "sales/misdirected");
    await drain(t);
    const receivers = t.app.get(AsyncApiHandler);

    const ended = await vi.waitFor(
      async () => {
        await receivers.sync();
        await drain(t);
        const instance = await instanceOf(t, editor, started.id);
        expect(instance.phase).toBe("faulted");
        return instance;
      },
      { timeout: 10_000, interval: 200 },
    );

    expect(ended.error).toMatchObject({
      type: "https://open-workflow-specification.org/spec/1.0.0/errors/configuration",
    });
  });

  it("an_amqp_receive_takes_from_its_queue_no_more_than_its_run_consumes", async () => {
    await channel.assertQueue("work");
    await channel.purgeQueue("work");

    for (const order of [1, 2, 3])
      channel.sendToQueue("work", Buffer.from(JSON.stringify({ order })), {
        contentType: "application/json",
      });

    const workflow = aDocument({ name: "worker" }, [
      {
        take: {
          call: "asyncapi",
          with: {
            document: { endpoint: `${documents.origin}/amqp.json` },
            channel: "work",
            subscription: { consume: { amount: 2 } },
          },
        },
      },
    ]);
    await publish(t, editor, workflow);
    const started = await start(t, editor, { input: {} }, "sales/worker");
    await drain(t);
    const receivers = t.app.get(AsyncApiHandler);

    const ended = await vi.waitFor(
      async () => {
        await receivers.sync();
        await drain(t);
        const instance = await instanceOf(t, editor, started.id);
        expect(instance.phase).toBe("completed");
        return instance;
      },
      { timeout: 15_000, interval: 200 },
    );
    const left = await vi.waitFor(
      async () => {
        await receivers.sync();
        const queue = await channel.checkQueue("work");
        expect(queue.consumerCount).toBe(0);
        return queue;
      },
      { timeout: 10_000, interval: 200 },
    );

    expect(ended.output).toMatchObject([
      { payload: { order: 1 } },
      { payload: { order: 2 } },
    ]);
    expect(left.messageCount).toBe(1);
  });
});
