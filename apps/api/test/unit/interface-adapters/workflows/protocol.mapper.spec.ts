import type { WorkflowQueries } from "../../../../src/application/automation/workflows/queries.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/workflows/mappers/protocol.mapper.js";

describe("the values the interpreter receives from the host", () => {
  const queries = {} as WorkflowQueries;
  const protocol = new ProtocolMapper(queries);

  it("a_member_without_a_value_does_not_reach_the_interpreter", () => {
    const value = { a: 1, b: undefined, c: [{ d: undefined, e: "x" }] };

    const sent = protocol.toValue(value);

    expect(sent).toStrictEqual({ a: 1, c: [{ e: "x" }] });
  });

  it("an_event_reaches_the_interpreter_with_its_attributes", () => {
    const event = {
      specversion: "1.0",
      id: "event-1",
      source: "/orders",
      type: "order.placed",
      subject: undefined,
      data: { total: 12 },
    };

    const sent = protocol.toCloudEvent(event);

    expect(sent).toStrictEqual({
      specversion: "1.0",
      id: "event-1",
      source: "/orders",
      type: "order.placed",
      data: { total: 12 },
    });
  });

  it("an_event_without_its_required_attributes_is_refused", () => {
    const event = { id: "event-1", source: "/orders", type: "order.placed" };

    expect(() => protocol.toCloudEvent(event)).toThrow(TypeError);
  });
});
