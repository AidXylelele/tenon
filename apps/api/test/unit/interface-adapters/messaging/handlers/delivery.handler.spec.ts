import type { TransactionHost } from "@nestjs-cls/transactional";
import type { NewOutboxMessage, Outbox } from "@nestjs/outbox";
import type { AcceptedEvent } from "../../../../../src/application/automation/events/interfaces.js";
import type { DeliverEvent } from "../../../../../src/application/automation/subscriptions/deliver-event.js";
import type { FailDelivery } from "../../../../../src/application/automation/subscriptions/fail-delivery.js";
import type { AttemptResult } from "../../../../../src/application/automation/subscriptions/interfaces.js";
import { Subscription } from "../../../../../src/domain/automation/subscriptions/subscription.js";
import { DeliveryMessagesProducer } from "../../../../../src/interface-adapters/messaging/producers/delivery-messages.producer.js";
import { DeliveryHandler } from "../../../../../src/interface-adapters/messaging/handlers/delivery.handler.js";
import { MessageTopic } from "../../../../../src/interface-adapters/messaging/enums.js";
import type { Transaction } from "../../../../../src/interface-adapters/persistence/interfaces.js";
import { T0 } from "../../../../support/fakes.js";
import { aHandlerContext } from "../../../../support/outbox.js";

const REFUSED = "The destination answered 503";
const DELIVERY = { subscriptionId: "subscription-1", sequence: 7 };

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

const contextAt = (attempt: number) =>
  aHandlerContext(MessageTopic.DeliveryRequested, "deliveries", attempt);

function setUp(refusals: number) {
  const deliveries = new ScriptedDeliveries(refusals);
  const failures = new RecordingFailures();
  const outbox = { notify: () => undefined } as unknown as Outbox;
  const handler = new DeliveryHandler(
    outbox,
    deliveries as unknown as DeliverEvent,
    failures as unknown as FailDelivery,
  );
  return { deliveries, failures, handler };
}

describe("the delivery of an event to a subscriber", () => {
  it("a_refused_delivery_is_tried_again_until_the_destination_takes_it", async () => {
    const fixture = setUp(2);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const context = contextAt(attempt);
      await fixture.handler.requested(DELIVERY, context).catch(() => null);
    }

    expect(fixture.deliveries.attempts).toBe(3);
    expect(fixture.failures.failed).toEqual([]);
  });

  it("a_refused_attempt_is_retried_with_its_reason", async () => {
    const fixture = setUp(1);
    const context = contextAt(1);

    const attempted = fixture.handler.requested(DELIVERY, context);

    await expect(attempted).rejects.toThrow(REFUSED);
  });

  it("a_delivery_its_attempts_never_brought_through_is_recorded_failed_once", async () => {
    const fixture = setUp(DeliveryHandler.ATTEMPTS);
    const context = contextAt(DeliveryHandler.ATTEMPTS);

    await fixture.handler.requested(DELIVERY, context);

    expect(fixture.failures.failed).toEqual(["subscription-1"]);
  });
});

describe("a delivery a match schedules", () => {
  it("is_an_outbox_message_ordered_by_its_subscription", async () => {
    const added: NewOutboxMessage[] = [];
    const outbox = {
      add: (_tx: unknown, message: NewOutboxMessage) => {
        added.push(message);
        return Promise.resolve();
      },
    } as unknown as Outbox;
    const txHost = { tx: {} } as unknown as TransactionHost<Transaction>;
    const gateway = new DeliveryMessagesProducer(txHost, outbox);
    const subscription = new Subscription({
      id: "subscription-1",
      ownerId: "owner-1",
      name: "orders",
      endpoint: {
        uri: "https://hooks.example.com",
        scheme: null,
        secret: null,
      },
      filter: {},
      createdAt: T0,
    });
    const event = { sequence: 7 } as AcceptedEvent;

    await gateway.schedule(subscription, event);

    expect(added).toEqual([
      {
        topic: MessageTopic.DeliveryRequested,
        key: "subscription-1",
        payload: DELIVERY,
      },
    ]);
  });
});
