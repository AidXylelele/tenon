import { type OutboxMessage, OutboxEvents } from "@nestjs/outbox";
import { OutboxMetrics } from "../../../../src/frameworks/opentelemetry/outbox.metrics.js";
import { RecordedMetrics } from "../../../support/recorded-metrics.js";

const CREATED = Date.UTC(2026, 0, 1);

const MESSAGE: OutboxMessage = {
  id: "0190a1b2-0000-7000-8000-000000000001",
  topic: "event.accepted",
  payload: { sequence: 7 },
  headers: {},
  key: "events",
  createdAt: CREATED,
  availableAt: CREATED,
  attempts: 0,
  lastError: null,
};

describe("the metrics of the outbox relay", () => {
  let recorded: RecordedMetrics;
  let events: OutboxEvents;
  let outboxMetrics: OutboxMetrics;

  beforeEach(() => {
    recorded = new RecordedMetrics();
    events = new OutboxEvents();
    outboxMetrics = new OutboxMetrics(events);
    outboxMetrics.onModuleInit();
  });

  afterEach(() => {
    outboxMetrics.onApplicationShutdown();
    vi.restoreAllMocks();
  });

  it("records_a_publish_and_the_lag_from_the_add_to_it_by_topic", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(CREATED + 1_500);

    events.emit({
      type: "published",
      message: MESSAGE,
      transport: "local",
      durationMs: 40,
    });

    expect(recorded.pointsOf("tenon.outbox.publish.duration")).toEqual([
      {
        value: 0.04,
        attributes: {
          "tenon.outbox.topic": "event.accepted",
          "tenon.outbox.transport": "local",
        },
      },
    ]);
    expect(recorded.pointsOf("tenon.outbox.lag")).toEqual([
      { value: 1.5, attributes: { "tenon.outbox.topic": "event.accepted" } },
    ]);
  });

  it("counts_a_retried_and_a_dead_lettered_publish_by_topic", () => {
    const error = new Error("The handler failed");

    events.emit({
      type: "retry-scheduled",
      message: MESSAGE,
      transport: "local",
      error,
      attempt: 1,
      delayMs: 1_000,
    });
    events.emit({
      type: "dead-lettered",
      message: MESSAGE,
      transport: "local",
      error,
      attempt: 20,
      reason: "exhausted",
    });

    expect(recorded.pointsOf("tenon.outbox.failures")).toEqual([
      {
        value: 1,
        attributes: {
          "tenon.outbox.topic": "event.accepted",
          "tenon.outbox.failure": "retry",
        },
      },
      {
        value: 1,
        attributes: {
          "tenon.outbox.topic": "event.accepted",
          "tenon.outbox.failure": "dead_letter",
        },
      },
    ]);
  });
});
