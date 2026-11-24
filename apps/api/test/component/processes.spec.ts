import type { INestApplication } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { getDrizzleToken } from "@nestjs/drizzle";
import { MailTransport } from "@nestjs/mail";
import { OutboxRelay } from "@nestjs/outbox";
import { SchedulerRegistry } from "@nestjs/schedule";
import { Test, type TestingModule } from "@nestjs/testing";
import { ApiModule } from "../../src/frameworks/di/api.module.js";
import { EffectClient } from "../../src/application/automation/instances/ports.js";
import { WorkerModule } from "../../src/frameworks/di/worker.module.js";
import { ReceiverSubscriptions } from "../../src/frameworks/asyncapi/receiver-subscriptions.js";
import { DeliveryHandler } from "../../src/interface-adapters/messaging/delivery.handler.js";
import { EffectHandler } from "../../src/interface-adapters/messaging/effect.handler.js";
import { RunHandler } from "../../src/interface-adapters/messaging/run.handler.js";
import { ScheduleHandler } from "../../src/interface-adapters/messaging/schedule.handler.js";
import { AsyncApiGateway } from "../../src/interface-adapters/asyncapi/asyncapi.gateway.js";
import { SandboxGateway } from "../../src/interface-adapters/workflows/effects/sandbox.gateway.js";
import type { Database } from "../../src/interface-adapters/persistence/interfaces.js";
import { truncateAll } from "../support/db.js";

const UNKNOWN = "this provider does not exist in the current context";

const WORKER_VARIABLES = [
  "SANDBOX_URL",
  "SANDBOX_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_STARTTLS",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];

const RETENTION_SCHEDULES = ["0 4 * * *", "30 3 * * *"];

const CONSUMERS = new Set<unknown>([
  RunHandler,
  EffectHandler,
  ScheduleHandler,
  DeliveryHandler,
]);

function consumersOf(app: INestApplication | TestingModule): unknown[] {
  const providers = app.get(DiscoveryService).getProviders();
  return providers
    .map((provider) => provider.metatype)
    .filter((metatype) => CONSUMERS.has(metatype));
}

describe("the API process, from its root module alone", () => {
  let api: INestApplication;

  beforeAll(async () => {
    for (const name of WORKER_VARIABLES) vi.stubEnv(name, undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();
    api = moduleRef.createNestApplication({ logger: false });
    await api.init();
  });

  afterAll(async () => {
    await api.close();
    vi.unstubAllEnvs();
  });

  it("starts_without_the_mail_and_sandbox_variables_and_serves_routes", () => {
    const controllers = api.get(DiscoveryService).getControllers();

    expect(controllers.length).toBeGreaterThan(0);
  });

  it("registers_no_outbox_consumer", () => {
    const consumers = consumersOf(api);

    expect(consumers).toEqual([]);
  });

  it("runs_no_outbox_relay", () => {
    const relay = api.get(OutboxRelay);

    expect(relay.running).toBe(false);
  });

  it("holds_no_mail_transport_sandbox_broker_receiver_or_effect_client", () => {
    expect(() => api.get(MailTransport)).toThrow(UNKNOWN);
    expect(() => api.get(SandboxGateway)).toThrow(UNKNOWN);
    expect(() => api.get(AsyncApiGateway)).toThrow(UNKNOWN);
    expect(() => api.get(ReceiverSubscriptions)).toThrow(UNKNOWN);
    expect(() => api.get(EffectClient)).toThrow(UNKNOWN);
  });

  it("schedules_only_the_idempotency_prune", () => {
    const scheduler = api.get(SchedulerRegistry);
    const intervals = scheduler.getIntervals();
    const cronJobs = scheduler.getCronJobs();
    const timeouts = scheduler.getTimeouts();

    expect(intervals).toEqual(["idempotency:prune"]);
    expect(cronJobs.size).toBe(0);
    expect(timeouts).toEqual([]);
  });
});

describe("the worker process, from its root module alone", () => {
  let worker: TestingModule;

  beforeAll(async () => {
    worker = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    worker.useLogger(false);
    const db = worker.get<Database>(getDrizzleToken());
    await truncateAll(db);
    await worker.init();
  });

  afterAll(async () => {
    await worker.close();
  });

  it("serves_no_route", () => {
    const controllers = worker.get(DiscoveryService).getControllers();

    expect(controllers).toEqual([]);
  });

  it("registers_every_outbox_consumer", () => {
    const consumers = consumersOf(worker);

    expect(consumers).toHaveLength(CONSUMERS.size);
  });

  it("runs_the_outbox_relay_and_the_two_retention_jobs", () => {
    const relay = worker.get(OutboxRelay);
    const jobs = worker.get(SchedulerRegistry).getCronJobs();
    const schedules = Array.from(
      jobs.values(),
      (job) => job.cronTime.source,
    ).toSorted();

    expect(relay.running).toBe(true);
    expect(schedules).toEqual(RETENTION_SCHEDULES);
  });

  it("leaves_the_idempotency_prune_to_the_api", () => {
    const intervals = worker.get(SchedulerRegistry).getIntervals();

    expect(intervals).not.toContain("idempotency:prune");
  });
});
