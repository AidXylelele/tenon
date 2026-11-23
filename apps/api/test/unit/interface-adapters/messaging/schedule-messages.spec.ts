import type { TransactionHost } from "@nestjs-cls/transactional";
import type {
  NewOutboxMessage,
  Outbox,
  OutboxHandlerContext,
  OutboxMessage,
} from "@nestjs/outbox";
import type { FireSchedule } from "../../../../src/application/automation/schedules/fire-schedule.js";
import type {
  FireScheduleCommand,
  StartScheduledCommand,
} from "../../../../src/application/automation/schedules/interfaces.js";
import type { StartScheduledInstance } from "../../../../src/application/automation/schedules/start-scheduled-instance.js";
import { ScheduleKind } from "../../../../src/domain/automation/workflows/enums.js";
import { Schedule } from "../../../../src/domain/automation/workflows/schedule.js";
import { Workflow } from "../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../src/domain/automation/workflows/workflow-name.js";
import { ConsumerSpan } from "../../../../src/interface-adapters/messaging/consumer-span.js";
import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { ScheduleHandler } from "../../../../src/interface-adapters/messaging/schedule.handler.js";
import { WorkflowMessagesGateway } from "../../../../src/interface-adapters/messaging/workflow-messages.gateway.js";
import type { Transaction } from "../../../../src/interface-adapters/persistence/interfaces.js";
import { aDefinition } from "../../../support/builders.js";
import { T0 } from "../../../support/fakes.js";

describe("an armed schedule", () => {
  it("is_a_message_held_until_its_slot_without_an_ordering_key", async () => {
    const added: NewOutboxMessage[] = [];
    const outbox = {
      add: (_tx: unknown, messages: NewOutboxMessage[]) => {
        for (const message of messages) added.push(message);

        return Promise.resolve();
      },
    } as unknown as Outbox;
    const txHost = { tx: {} } as unknown as TransactionHost<Transaction>;
    const gateway = new WorkflowMessagesGateway(txHost, outbox);
    const workflow = Workflow.register(new WorkflowName("sales", "route-lead"));
    const schedule = new Schedule({
      kind: ScheduleKind.Every,
      interval: 60_000,
    });
    const definition = aDefinition({}, "content-1", schedule);
    workflow.publish({ definition, source: null, publisherId: "a-1", now: T0 });
    workflow.turnOn(T0);

    await gateway.dispatch(workflow);

    expect(added).toEqual([
      {
        topic: MessageTopic.ScheduleArmed,
        key: null,
        payload: {
          workflowId: workflow.id,
          arming: 1,
          at: T0.getTime() + 60_000,
        },
        availableAt: T0.getTime() + 60_000,
      },
    ]);
    expect(workflow.events).toEqual([]);
  });

  it("fires_its_arming_when_its_slot_comes", async () => {
    const fired: FireScheduleCommand[] = [];
    const fireSchedule = {
      execute: (command: FireScheduleCommand) => {
        fired.push(command);
        return Promise.resolve();
      },
    } as unknown as FireSchedule;
    let notified = 0;
    const outbox = {
      notify: () => {
        notified += 1;
      },
    } as unknown as Outbox;
    const starts = {} as StartScheduledInstance;
    const handler = new ScheduleHandler(
      new ConsumerSpan(),
      outbox,
      fireSchedule,
      starts,
    );
    const message = { workflowId: "w-1", arming: 4, at: 1_000 };
    const context = {
      message: { topic: MessageTopic.ScheduleArmed } as OutboxMessage,
      consumer: "schedules",
      attempt: 1,
      signal: new AbortController().signal,
      processInTransaction: () => Promise.reject(new Error("Not used")),
    } as OutboxHandlerContext;

    await handler.armed(message, context);

    expect(fired).toEqual([{ workflowId: "w-1", arming: 4, at: 1_000 }]);
    expect(notified).toBe(1);
  });

  it("a_fired_slot_starts_one_instance_whose_id_the_slot_decides", async () => {
    const started: StartScheduledCommand[] = [];
    const starts = {
      execute: (command: StartScheduledCommand) => {
        started.push(command);
        return Promise.resolve();
      },
    } as unknown as StartScheduledInstance;
    const outbox = { notify: () => undefined } as unknown as Outbox;
    const handler = new ScheduleHandler(
      new ConsumerSpan(),
      outbox,
      {} as FireSchedule,
      starts,
    );
    const context = {
      message: { topic: MessageTopic.ScheduleFired } as OutboxMessage,
      consumer: "schedules",
      attempt: 1,
      signal: new AbortController().signal,
      processInTransaction: () => Promise.reject(new Error("Not used")),
    } as OutboxHandlerContext;
    const slot = { workflowId: "w-1", at: 1_000 };
    const other = { workflowId: "w-1", at: 2_000 };

    await handler.fired(slot, context);
    await handler.fired(slot, context);
    await handler.fired(other, context);

    const ids = started.map((command) => command.instanceId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
    expect(ids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
