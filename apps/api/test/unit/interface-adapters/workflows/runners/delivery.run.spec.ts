import type { INestApplicationContext } from "@nestjs/common";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Test } from "@nestjs/testing";
import {
  WorkflowClient,
  WorkflowsModule,
  WorkflowWorker,
} from "@nestjs/workflows";
import type { AttemptResult } from "../../../../../src/application/automation/subscriptions/interfaces.js";
import { DeliverEvent } from "../../../../../src/application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../../../../src/application/automation/subscriptions/fail-delivery.js";
import { DeliveryRun } from "../../../../../src/interface-adapters/workflows/runners/delivery.run.js";
import { RunTracer } from "../../../../../src/interface-adapters/workflows/runners/run.tracer.js";
import { RecordedSpans } from "../../../../support/recorded-spans.js";

const T0 = Date.UTC(2026, 0, 1);
const AN_HOUR = 3_600_000;
const ATTEMPTS = 36;
const REFUSED = "The destination answered 503";
const ID = "delivery:subscription-1:7";

class ScriptedDeliveries {
  attempts = 0;

  constructor(private readonly refusals: number) {}

  execute(): Promise<AttemptResult> {
    this.attempts += 1;

    if (this.attempts > this.refusals)
      return Promise.resolve({ ok: true, value: undefined });

    return Promise.resolve({ ok: false, failure: REFUSED });
  }
}

class RecordingFailures {
  readonly failed: string[] = [];

  execute(input: { readonly subscriptionId: string }): Promise<void> {
    this.failed.push(input.subscriptionId);
    return Promise.resolve();
  }
}

describe("the delivery of an event to a subscriber", () => {
  let app: INestApplicationContext;
  let failures: RecordingFailures;
  let spans: RecordedSpans;

  async function delivered(deliveries: ScriptedDeliveries): Promise<void> {
    failures = new RecordingFailures();
    const moduleRef = await Test.createTestingModule({
      imports: [
        WorkflowsModule.forRoot({
          worker: { enabled: false },
          allowInMemoryStorage: true,
        }),
      ],
      providers: [
        DeliveryRun,
        { provide: DeliverEvent, useValue: deliveries },
        { provide: FailDelivery, useValue: failures },
        {
          provide: RunTracer,
          useValue: new RunTracer(trace.getTracer("test")),
        },
      ],
    }).compile();
    app = await moduleRef.init();
    const input = { subscriptionId: "subscription-1", sequence: 7 };
    await app.get(WorkflowClient).start("delivery", input, { id: ID });
    const worker = app.get(WorkflowWorker);

    for (let hour = 0; hour <= ATTEMPTS; hour += 1) {
      await worker.drain();
      vi.setSystemTime(Date.now() + AN_HOUR);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    spans = new RecordedSpans();
  });

  afterEach(async () => {
    await app.close();
    await spans.stop();
  });

  it("a_refused_delivery_is_tried_again_until_the_destination_takes_it", async () => {
    const deliveries = new ScriptedDeliveries(2);

    await delivered(deliveries);

    expect(deliveries.attempts).toBe(3);
    expect(failures.failed).toEqual([]);
  });

  it("a_delivery_its_attempts_never_brought_through_is_recorded_failed_once_as_a_delivery_failure", async () => {
    const deliveries = new ScriptedDeliveries(ATTEMPTS);

    await delivered(deliveries);
    const status = await app
      .get(WorkflowClient)
      .getStatus(ID, { journal: true });
    const deliver = status?.journal.find((entry) => entry.name === "deliver");

    expect(deliveries.attempts).toBe(ATTEMPTS);
    expect(failures.failed).toEqual(["subscription-1"]);
    expect(deliver?.error).toMatchObject({
      name: "DeliveryFailed",
      message: REFUSED,
    });
    expect(status?.status).toBe("completed");
  });

  it("traces_each_attempt_and_marks_the_refused_one_an_error_while_its_execution_waits_for_the_retry", async () => {
    const deliveries = new ScriptedDeliveries(1);

    await delivered(deliveries);

    const attempts = spans.named("step deliver");
    const executions = spans.named("execute delivery");
    expect(
      attempts.map((span) => span.attributes["tenon.step.attempt"]),
    ).toEqual([1, 2]);
    expect(attempts.map((span) => span.status)).toEqual([
      { code: SpanStatusCode.ERROR, message: REFUSED },
      { code: SpanStatusCode.UNSET },
    ]);
    expect(executions.map((span) => span.status.code)).toEqual([
      SpanStatusCode.UNSET,
      SpanStatusCode.UNSET,
    ]);
  });
});
