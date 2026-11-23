import {
  NonRetryableMessageError,
  type Outbox,
  type OutboxHandlerContext,
  type OutboxMessage,
} from "@nestjs/outbox";
import type { TriggerCommand } from "../../../../src/application/automation/schedules/interfaces.js";
import type { StartOnEvent } from "../../../../src/application/automation/schedules/start-on-event.js";
import { AutomationHandler } from "../../../../src/interface-adapters/messaging/automation.handler.js";
import { ConsumerSpan } from "../../../../src/interface-adapters/messaging/consumer-span.js";
import { PermanentFault } from "../../../../src/interface-adapters/workflows/permanent-fault.error.js";

class Recorder {
  readonly triggers: TriggerCommand[] = [];
  notified = 0;
  failure: Error | null = null;

  startOnEvent(): StartOnEvent {
    const execute = (command: TriggerCommand) => {
      this.triggers.push(command);

      if (this.failure !== null) return Promise.reject(this.failure);

      return Promise.resolve();
    };
    return { execute } as unknown as StartOnEvent;
  }

  outbox(): Outbox {
    const outbox = {
      notify: () => {
        this.notified += 1;
      },
    };
    return outbox as unknown as Outbox;
  }
}

function handlerOf(recorder: Recorder): AutomationHandler {
  const unused = {} as never;
  return new AutomationHandler(
    new ConsumerSpan(),
    recorder.outbox(),
    unused,
    unused,
    recorder.startOnEvent(),
    unused,
    unused,
    unused,
    unused,
  );
}

function contextAt(attempt: number): OutboxHandlerContext {
  const message = {
    id: "message-1",
    topic: "trigger.offered",
    payload: {},
    headers: {},
    key: "order-1",
    createdAt: 0,
    availableAt: 0,
    attempts: attempt - 1,
    lastError: null,
  } as OutboxMessage;
  return {
    message,
    consumer: "triggers",
    attempt,
    signal: new AbortController().signal,
    processInTransaction: () => Promise.reject(new Error("Not used")),
  };
}

describe("a start an accepted event triggers", () => {
  it("names_its_instance_after_the_workflow_and_the_event_alone", async () => {
    const recorder = new Recorder();
    const handler = handlerOf(recorder);
    const context = contextAt(1);

    await handler.triggered({ workflowId: "w-1", sequence: 7 }, context);
    await handler.triggered({ workflowId: "w-1", sequence: 7 }, context);
    await handler.triggered({ workflowId: "w-1", sequence: 8 }, context);

    const ids = recorder.triggers.map((command) => command.instanceId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
    expect(recorder.notified).toBe(3);
  });

  it("a_permanent_fault_goes_to_the_dead_letters_at_once", async () => {
    const recorder = new Recorder();
    recorder.failure = new PermanentFault("The interpreter ran out of memory");
    const handler = handlerOf(recorder);
    const context = contextAt(1);

    const handled = handler.triggered(
      { workflowId: "w-1", sequence: 7 },
      context,
    );

    await expect(handled).rejects.toBeInstanceOf(NonRetryableMessageError);
    expect(recorder.notified).toBe(0);
  });

  it("a_transient_failure_is_retried", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The database is busy");
    const handler = handlerOf(recorder);
    const context = contextAt(1);

    const handled = handler.triggered(
      { workflowId: "w-1", sequence: 7 },
      context,
    );

    await expect(handled).rejects.toThrow("The database is busy");
  });
});
