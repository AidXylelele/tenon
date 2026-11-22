import { InstanceCursor } from "../../../src/interface-adapters/api/schemas/instance.schema.js";
import { WorkflowCursor } from "../../../src/interface-adapters/api/schemas/workflow.schema.js";

describe("the page cursors", () => {
  it("an_instance_position_comes_back_from_its_cursor", () => {
    const position = {
      createdAt: new Date("2026-11-22T06:00:00.000Z"),
      id: "0b6f3c3e-5a7d-4c1e-9f62-2d8e1a4b7c90",
    };

    const cursor = InstanceCursor.encode(position);
    const decoded = InstanceCursor.decode(cursor);

    expect(cursor).toBe("1795327200000_0b6f3c3e-5a7d-4c1e-9f62-2d8e1a4b7c90");
    expect(decoded).toEqual(position);
  });

  it.each([
    "garbage",
    "1795327200000_not-an-id",
    "99999999999999999_0b6f3c3e-5a7d-4c1e-9f62-2d8e1a4b7c90",
    "_0b6f3c3e-5a7d-4c1e-9f62-2d8e1a4b7c90",
  ])("a_malformed_instance_cursor_is_refused (%s)", (cursor) => {
    const parsed = InstanceCursor.safeParse(cursor);

    expect(parsed.success).toBe(false);
  });

  it("a_workflow_position_comes_back_from_its_cursor", () => {
    const position = { namespace: "billing", name: "send-invoice" };

    const cursor = WorkflowCursor.encode(position);
    const decoded = WorkflowCursor.decode(cursor);

    expect(decoded).toEqual(position);
  });

  it("a_workflow_cursor_without_names_of_the_standard_is_refused", () => {
    const named = Buffer.from("billing").toString("base64url");

    const parsed = WorkflowCursor.safeParse(named);

    expect(parsed.success).toBe(false);
  });
});
