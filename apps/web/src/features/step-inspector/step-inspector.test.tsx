import { fireEvent, render, screen } from "@testing-library/react";
import type { Step, StepFormResult } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { StepInspector } from "./step-inspector";

const fetchLead: Step = {
  id: "/do/fetchLead",
  pointer: "/do/0/fetchLead",
  name: "fetchLead",
  kind: "call",
  family: "call",
  summary: null,
  note: null,
  range: null,
  selectionRange: null,
  lists: [],
  flow: [],
  milliseconds: null,
};

const form: StepFormResult = {
  version: 3,
  step: fetchLead.id,
  failure: "stop",
  fields: [],
};

function inspect(onEdit = vi.fn()) {
  render(
    <StepInspector
      step={fetchLead}
      form={form}
      formless={false}
      place={{ list: "/do", index: 0, size: 2 }}
      onEdit={onEdit}
      onClose={vi.fn()}
    />,
  );
  return onEdit;
}

describe("the inspector of one task", () => {
  it("choosing_to_try_again_asks_the_server_to_protect_the_task", () => {
    const onEdit = inspect();

    fireEvent.click(screen.getByRole("radio", { name: "Try again" }));

    expect(onEdit).toHaveBeenCalledWith({
      kind: "setFailure",
      step: "/do/fetchLead",
      failure: { kind: "retry", attempts: 3, seconds: 5, growing: false },
    });
  });

  it("a_new_name_renames_the_task_and_the_first_task_cannot_go_up", () => {
    const onEdit = inspect();
    const name = screen.getByLabelText("Name");

    fireEvent.change(name, { target: { value: "loadLead" } });
    fireEvent.blur(name);

    expect(onEdit).toHaveBeenCalledWith({
      kind: "renameStep",
      step: "/do/fetchLead",
      name: "loadLead",
    });
    expect(screen.getByRole("button", { name: "Up" })).toBeDisabled();
  });
});
