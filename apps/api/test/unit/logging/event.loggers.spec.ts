import { AuthenticationEvents } from "@nestjs/authentication";
import { Logger } from "@nestjs/common";
import { OutboxEvents } from "@nestjs/outbox";
import { WorkflowEvents } from "@nestjs/workflows";
import { AuthenticationLogger } from "../../../src/frameworks/authentication/authentication.logger.js";
import { OutboxLogger } from "../../../src/frameworks/outbox/outbox.logger.js";
import { EngineLogger } from "../../../src/frameworks/workflows/engine.logger.js";

describe("the loggers of the events that need a person or an audit", () => {
  const log = vi
    .spyOn(Logger.prototype, "log")
    .mockImplementation(() => undefined);
  const warn = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);
  const error = vi
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    log.mockClear();
    warn.mockClear();
    error.mockClear();
  });

  afterAll(() => {
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  const message = {
    id: "message-1",
    topic: "mail.password-reset",
    payload: { to: "user@example.com" },
    headers: {},
    key: null,
    createdAt: 0,
    availableAt: 0,
    attempts: 3,
    lastError: null,
  };

  it("an_outbox_dead_letter_is_an_error_without_its_payload_and_a_lost_lease_is_left_to_the_relay", () => {
    const events = new OutboxEvents();
    new OutboxLogger(events).onModuleInit();
    const refusal = new Error("550 User unknown");

    events.emit({
      type: "dead-lettered",
      message,
      transport: "local",
      error: refusal,
      attempt: 3,
      reason: "rejected",
    });
    events.emit({ type: "lease-lost", message });

    expect(error).toHaveBeenCalledExactlyOnceWith(
      {
        messageId: "message-1",
        topic: "mail.password-reset",
        transport: "local",
        attempt: 3,
        reason: "rejected",
        err: refusal,
      },
      "The outbox dead-lettered a mail.password-reset message",
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("a_failed_compensation_is_an_error_that_needs_a_person", () => {
    const events = new WorkflowEvents();
    new EngineLogger(events).onModuleInit();
    const failure = { name: "Error", message: "the database is down" };

    events.emit({
      type: "workflow-compensation-failed",
      id: "instance-1",
      workflow: "open-workflow",
      version: 1,
      at: 0,
      error: failure,
    });
    events.emit({
      type: "workflow-completed",
      id: "instance-2",
      workflow: "open-workflow",
      version: 1,
      at: 0,
      output: null,
    });

    expect(error).toHaveBeenCalledExactlyOnceWith(
      {
        instanceId: "instance-1",
        workflow: "open-workflow",
        version: 1,
        err: failure,
      },
      "The compensation of open-workflow instance instance-1 failed and needs a person",
    );
  });

  it("the_authentication_audit_trail_names_each_event_and_its_user_but_no_address", () => {
    const events = new AuthenticationEvents();
    new AuthenticationLogger(events).onModuleInit();

    events.emit({ type: "sign-in", userId: "user-1", method: "password" });
    events.emit({
      type: "password-reset-requested",
      email: "nobody@example.com",
    });
    events.emit({
      type: "session-touch-failed",
      userId: "user-1",
      sessionId: "session-1",
      error: new Error("read-only replica"),
    });

    expect(log.mock.calls).toEqual([
      [{ event: "sign-in", userId: "user-1" }, "Authentication: sign-in"],
      [
        { event: "password-reset-requested", userId: undefined },
        "Authentication: password-reset-requested",
      ],
    ]);
  });
});
