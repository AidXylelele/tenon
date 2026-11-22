import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  WorkflowClient,
  WorkflowsModule,
  WorkflowWorker,
} from "@nestjs/workflows";
import type { AttemptResult } from "../../../../src/application/automation/subscriptions/interfaces.js";
import { DeliverEvent } from "../../../../src/application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../../../src/application/automation/subscriptions/fail-delivery.js";
import { DeliveryRun } from "../../../../src/interface-adapters/workflows/runners/delivery.run.js";

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
  });

  afterEach(async () => {
    await app.close();
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
});
