import { WorkflowCursor } from "../../../../../src/interface-adapters/api/schemas/workflow.schema.js";

describe("the page cursors", () => {
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
