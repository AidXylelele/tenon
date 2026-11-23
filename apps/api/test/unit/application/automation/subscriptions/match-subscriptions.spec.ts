import type { AcceptedEvent } from "../../../../../src/application/automation/events/interfaces.js";
import type { EventStore } from "../../../../../src/application/automation/events/ports.js";
import { MatchSubscriptions } from "../../../../../src/application/automation/subscriptions/match-subscriptions.js";
import type {
  DeliveryLog,
  SubscriptionFilters,
  SubscriptionRepository,
} from "../../../../../src/application/automation/subscriptions/ports.js";
import type { Subscription } from "../../../../../src/domain/automation/subscriptions/subscription.js";
import { FakeUnitOfWork, T0 } from "../../../../support/fakes.js";

const PAID: AcceptedEvent = {
  sequence: 7,
  eventId: "order-1",
  type: "com.example.order.paid",
  cloudEvent: { id: "order-1", type: "com.example.order.paid" },
  acceptedAt: T0,
  lifecycleOf: null,
};

class PendingLog {
  readonly logged = new Set<string>();

  pending(subscription: Subscription): Promise<boolean> {
    const known = this.logged.has(subscription.id);
    this.logged.add(subscription.id);
    return Promise.resolve(!known);
  }
}

class ScheduledDeliveries {
  readonly scheduled: string[] = [];

  schedule(subscription: Subscription): Promise<void> {
    this.scheduled.push(subscription.id);
    return Promise.resolve();
  }
}

function setUp(accepts = true) {
  const subscription = { id: "subscription-1" } as Subscription;
  const events = {
    find: () => Promise.resolve(PAID),
  } as unknown as EventStore;
  const subscriptions = {
    existingAt: () => Promise.resolve([subscription]),
  } as unknown as SubscriptionRepository;
  const filters = {
    matching: (candidates: readonly Subscription[]) =>
      Promise.resolve(candidates.filter(() => accepts)),
  } as unknown as SubscriptionFilters;
  const log = new PendingLog();
  const deliveries = new ScheduledDeliveries();
  const unitOfWork = new FakeUnitOfWork();
  const match = new MatchSubscriptions(
    events,
    subscriptions,
    filters,
    deliveries,
    log as unknown as DeliveryLog,
    unitOfWork,
  );
  return { match, deliveries, unitOfWork };
}

describe("matching an accepted event to the subscriptions", () => {
  it("a_match_repeated_after_a_crash_schedules_no_second_delivery", async () => {
    const fixture = setUp();
    const signal = new AbortController().signal;
    const command = { sequence: PAID.sequence, signal };

    await fixture.match.execute(command);
    await fixture.match.execute(command);

    expect(fixture.deliveries.scheduled).toEqual(["subscription-1"]);
  });

  it("an_event_no_subscription_accepts_opens_no_transaction", async () => {
    const fixture = setUp(false);
    const signal = new AbortController().signal;

    await fixture.match.execute({ sequence: PAID.sequence, signal });

    expect(fixture.unitOfWork.runs).toBe(0);
  });
});
