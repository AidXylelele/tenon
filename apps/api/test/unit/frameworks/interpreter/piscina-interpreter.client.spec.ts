import type { ResilienceService } from "@nestjs/resilience";
import type { HostEnd } from "interpreter";
import { PiscinaInterpreterClient } from "../../../../src/frameworks/interpreter/piscina-interpreter.client.js";

const resilience = {} as ResilienceService;
const threads = { runs: 1, checks: 1 };

const cancelled: HostEnd = {
  identity: {
    namespace: "sales",
    name: "greet",
    version: "1.0.0",
    dsl: "1.1.0",
  },
  instance: "instance-1",
  phase: "cancelled",
  now: Date.UTC(2026, 0, 1),
};

describe("the interpreter client's lifecycle event types", () => {
  it("are_the_standards_alone_by_default", () => {
    const client = new PiscinaInterpreterClient(resilience, {}, threads);

    const types = client.lifecycleEventTypes();
    const ending = client.ending(cancelled);

    expect(types["workflow.cancelled"]).toEqual([
      "org.open-workflow-specification.workflow.cancelled.v1",
    ]);
    expect(ending.events[0]?.types).toEqual([
      "org.open-workflow-specification.workflow.cancelled.v1",
    ]);
  });

  it("add_the_legacy_type_to_the_host_profile_and_the_hosts_ending_when_asked", () => {
    const options = { legacyEventTypes: true };
    const client = new PiscinaInterpreterClient(resilience, options, threads);
    const both = [
      "org.open-workflow-specification.workflow.cancelled.v1",
      "io.serverlessworkflow.workflow.cancelled.v1",
    ];

    const types = client.lifecycleEventTypes();
    const ending = client.ending(cancelled);

    expect(types["workflow.cancelled"]).toEqual(both);
    expect(ending.events[0]?.types).toEqual(both);
  });
});
