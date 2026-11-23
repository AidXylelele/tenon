import { DispatchEvent } from "../../../../../src/application/automation/events/dispatch-event.js";
import type {
  AcceptedEvent,
  InstanceOffer,
} from "../../../../../src/application/automation/events/interfaces.js";
import type { EventStore } from "../../../../../src/application/automation/events/ports.js";
import type { RoutingMatch } from "../../../../../src/domain/automation/instances/interfaces.js";
import { FakeUnitOfWork, T0 } from "../../../../support/fakes.js";

const PAID: AcceptedEvent = {
  sequence: 7,
  eventId: "order-1",
  type: "order.paid",
  cloudEvent: { id: "order-1", type: "order.paid" },
  acceptedAt: T0,
  lifecycleOf: null,
};

const MATCH: RoutingMatch = {
  versionId: "version-1",
  stream: "orders",
  level: 0,
  filter: 0,
};

const OFFER: InstanceOffer = {
  instanceId: "instance-1",
  candidates: ["/do/0/wait"],
};

class RecordingOffers {
  readonly offered: (readonly InstanceOffer[])[] = [];
  readonly triggered: (readonly string[])[] = [];

  offer(offers: readonly InstanceOffer[]): Promise<void> {
    this.offered.push(offers);
    return Promise.resolve();
  }

  trigger(workflowIds: readonly string[]): Promise<void> {
    this.triggered.push(workflowIds);
    return Promise.resolve();
  }
}

function setUp(matches: readonly RoutingMatch[]) {
  const events = { find: () => Promise.resolve(PAID) };
  const listeners = {
    programsFor: () => Promise.resolve([{ versionId: "version-1" }]),
    instancesFor: () => Promise.resolve([OFFER]),
    workflowsFor: () => Promise.resolve(["workflow-1"]),
  };
  const routing = { accepting: () => Promise.resolve(matches) };
  const offers = new RecordingOffers();
  const unitOfWork = new FakeUnitOfWork();
  const dispatch = new DispatchEvent(
    events as unknown as EventStore,
    listeners,
    routing,
    offers,
    unitOfWork,
  );
  return { dispatch, offers, unitOfWork };
}

describe("dispatching an accepted event", () => {
  const signal = new AbortController().signal;

  it("offers_it_to_its_listeners_and_triggers_its_workflows_in_one_unit_of_work", async () => {
    const fixture = setUp([MATCH]);

    await fixture.dispatch.execute({ sequence: 7, signal });

    expect(fixture.offers.offered).toEqual([[OFFER]]);
    expect(fixture.offers.triggered).toEqual([["workflow-1"]]);
    expect(fixture.unitOfWork.runs).toBe(1);
  });

  it("an_event_no_program_accepts_opens_no_unit_of_work", async () => {
    const fixture = setUp([]);

    await fixture.dispatch.execute({ sequence: 7, signal });

    expect(fixture.offers.offered).toEqual([]);
    expect(fixture.unitOfWork.runs).toBe(0);
  });
});
