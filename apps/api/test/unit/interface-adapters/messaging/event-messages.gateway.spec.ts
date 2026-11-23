import type { TransactionHost } from "@nestjs-cls/transactional";
import type { Outbox } from "@nestjs/outbox";
import { EventOrigin } from "../../../../src/application/automation/events/enums.js";
import type { AcceptedEvent } from "../../../../src/application/automation/events/interfaces.js";
import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { EventMessagesGateway } from "../../../../src/interface-adapters/messaging/event-messages.gateway.js";
import type { Transaction } from "../../../../src/interface-adapters/persistence/interfaces.js";
import { T0 } from "../../../support/fakes.js";
import { RecordingOutbox } from "../../../support/outbox.js";

const TX = { id: "tx-1" };
const cloudEvent = { id: "order-1", source: "/shop", type: "order.paid" };

const PAID: AcceptedEvent = {
  sequence: 7,
  eventId: "order-1",
  type: "order.paid",
  cloudEvent,
  acceptedAt: T0,
  lifecycleOf: null,
};

function setUp() {
  const outbox = new RecordingOutbox();
  const txHost = { tx: TX } as unknown as TransactionHost<Transaction>;
  const gateway = new EventMessagesGateway(txHost, outbox as unknown as Outbox);
  return { outbox, gateway };
}

describe("the outbox messages of accepted events", () => {
  it("an_emitted_or_lifecycle_event_keeps_its_sources_lane_and_any_other_its_own", async () => {
    const fixture = setUp();

    await fixture.gateway.announce(1, EventOrigin.Emit, cloudEvent);
    await fixture.gateway.announce(2, EventOrigin.Lifecycle, cloudEvent);
    await fixture.gateway.announce(3, EventOrigin.Webhook, cloudEvent);
    await fixture.gateway.announce(4, EventOrigin.Intake, cloudEvent);

    const keys = fixture.outbox.added.map((message) => message.key);
    expect(fixture.outbox.added[0]).toEqual({
      topic: MessageTopic.EventAccepted,
      key: "/shop",
      payload: { sequence: 1 },
    });
    expect(keys).toEqual(["/shop", "/shop", "order-1", "order-1"]);
    expect(fixture.outbox.transactions).toEqual([TX, TX, TX, TX]);
  });

  it("an_offer_goes_to_each_listening_instance_and_a_trigger_to_each_workflow", async () => {
    const fixture = setUp();
    const offers = [{ instanceId: "instance-1", candidates: ["/do/0/wait"] }];

    await fixture.gateway.offer(offers, PAID);
    await fixture.gateway.trigger(["workflow-1"], PAID);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.EventOffered,
        key: "instance-1",
        payload: {
          instanceId: "instance-1",
          sequence: 7,
          candidates: ["/do/0/wait"],
        },
      },
      {
        topic: MessageTopic.TriggerOffered,
        key: "order-1",
        payload: { workflowId: "workflow-1", sequence: 7 },
      },
    ]);
  });

  it("no_listener_and_no_trigger_add_nothing", async () => {
    const fixture = setUp();

    await fixture.gateway.offer([], PAID);
    await fixture.gateway.trigger([], PAID);

    expect(fixture.outbox.added).toEqual([]);
  });
});
