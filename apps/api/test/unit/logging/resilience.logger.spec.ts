import { Logger } from "@nestjs/common";
import { ResilienceEvents } from "@nestjs/resilience";
import { ResilienceLogger } from "../../../src/frameworks/resilience/resilience.logger.js";

describe("the resilience logger", () => {
  const warn = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);
  let events: ResilienceEvents;

  beforeEach(() => {
    warn.mockClear();
    events = new ResilienceEvents();
    new ResilienceLogger(events).onModuleInit();
  });

  afterAll(() => {
    warn.mockRestore();
  });

  it("a_circuit_transition_is_logged_as_a_warning", () => {
    events.emit({
      type: "circuit-open",
      policy: "processes",
      from: "closed",
      to: "open",
    });

    expect(warn).toHaveBeenCalledWith(
      { policy: "processes", from: "closed", to: "open" },
      "The processes circuit went from closed to open",
    );
  });

  it("a_bulkhead_at_capacity_is_logged_with_its_load", () => {
    events.emit({
      type: "bulkhead-rejected",
      policy: "interpreter-checks",
      reason: "queue-timeout",
      active: 2,
      queued: 4,
    });

    expect(warn).toHaveBeenCalledWith(
      {
        policy: "interpreter-checks",
        source: undefined,
        reason: "queue-timeout",
        active: 2,
        queued: 4,
      },
      "The interpreter-checks bulkhead is at capacity",
    );
  });

  it("a_timeout_of_one_call_is_not_an_alert", () => {
    events.emit({ type: "timeout", policy: "service-calls", timeoutMs: 30 });

    expect(warn).not.toHaveBeenCalled();
  });
});
