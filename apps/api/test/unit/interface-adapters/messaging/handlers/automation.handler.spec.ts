import { NonRetryableMessageError, type Outbox } from "@nestjs/outbox";
import type { TriggerCommand } from "../../../../../src/application/automation/schedules/interfaces.js";
import type { StartOnEvent } from "../../../../../src/application/automation/schedules/start-on-event.js";
import { AutomationHandler } from "../../../../../src/interface-adapters/messaging/handlers/automation.handler.js";
import { MessageTopic } from "../../../../../src/interface-adapters/messaging/enums.js";
import { PermanentFault } from "../../../../../src/interface-adapters/interpreter/permanent-fault.error.js";
import { aHandlerContext } from "../../../../support/outbox.js";

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

describe("a start an accepted event triggers", () => {
  it("names_its_instance_after_the_workflow_and_the_event_alone", async () => {
    const recorder = new Recorder();
    const handler = handlerOf(recorder);
    const context = aHandlerContext(MessageTopic.TriggerOffered, "triggers");

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
    const context = aHandlerContext(MessageTopic.TriggerOffered, "triggers");

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
    const context = aHandlerContext(MessageTopic.TriggerOffered, "triggers");

    const handled = handler.triggered(
      { workflowId: "w-1", sequence: 7 },
      context,
    );

    await expect(handled).rejects.toThrow("The database is busy");
  });
});
