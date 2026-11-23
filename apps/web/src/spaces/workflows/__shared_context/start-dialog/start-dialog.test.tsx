import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { visit } from "@/libs/routing/navigation.test-support";
import { RunVersionButton, StartDialog } from "./start-dialog";

const { push, startAction } = vi.hoisted(() => ({
  push: vi.fn(),
  startAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("next/navigation", async () => {
  const address = await import("@/libs/routing/navigation.test-support");
  return { ...address, useRouter: () => ({ push }) };
});
vi.mock("./actions", () => ({ startAction }));

const unreachable = {
  ok: false,
  problem: {
    type: "about:blank",
    title: "The platform is not answering",
    status: 503,
    detail: "The platform is not answering; try again in a moment",
    errors: [],
  },
};

describe("starting a run", () => {
  beforeEach(() => {
    visit("/workflows/sales/route-lead");
    push.mockClear();
    startAction.mockReset();
  });

  function openWith(json: string) {
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.change(screen.getByLabelText("Input"), {
      target: { value: json },
    });
  }

  it("a_retried_start_carries_the_same_key_and_a_changed_one_a_new_key", async () => {
    startAction.mockResolvedValue(unreachable);
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={["1.0.0"]}
        currentVersion="1.0.0"
        inputSchema={null}
      />,
    );
    openWith('{"email": "ada@example.com"}');

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText(
      "The platform is not answering; try again in a moment",
    );
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    await waitFor(() => {
      expect(startAction).toHaveBeenCalledTimes(2);
    });
    fireEvent.change(screen.getByLabelText("Input"), {
      target: { value: '{"email": "bob@example.com"}' },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    await waitFor(() => {
      expect(startAction).toHaveBeenCalledTimes(3);
    });

    const keys = startAction.mock.calls.map((call) => call[4]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("a_started_run_opens_its_page", async () => {
    startAction.mockResolvedValue({ ok: true, value: { id: "run-1" } });
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={[]}
        currentVersion="1.0.0"
        inputSchema={null}
      />,
    );
    openWith("{}");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/runs/run-1");
    });
    expect(startAction).toHaveBeenCalledWith(
      "sales",
      "route-lead",
      "latest",
      {},
      expect.any(String),
    );
  });

  it("an_input_schema_gives_the_input_a_form", async () => {
    startAction.mockResolvedValue({ ok: true, value: { id: "run-1" } });
    const document = {
      type: "object",
      properties: { email: { type: "string" }, score: { type: "number" } },
      required: ["email"],
    };
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={[]}
        currentVersion="1.0.0"
        inputSchema={{ format: "json", document }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    const email = screen.getByLabelText("email (required)");

    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.blur(email);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(startAction).toHaveBeenCalledWith(
        "sales",
        "route-lead",
        "latest",
        { email: "ada@example.com" },
        expect.any(String),
      );
    });
  });

  it("an_input_the_schema_refuses_is_shown_at_its_field_and_the_dialog_stays", async () => {
    startAction.mockResolvedValue({
      ok: false,
      problem: {
        type: "urn:problem:instance.input-invalid",
        title: "Input refused",
        status: 422,
        detail: "The input does not match the workflow's input schema",
        errors: [
          {
            pointer: "/input/email",
            detail: "Email is required",
            line: null,
            column: null,
          },
        ],
        retryAfter: null,
      },
    });
    const document = {
      type: "object",
      properties: { email: { type: "string", title: "Email" } },
      required: ["email"],
    };
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={[]}
        currentVersion="1.0.0"
        inputSchema={{ format: "json", document }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    const refusal = await screen.findByText("Email is required");
    const email = screen.getByRole("textbox", { name: "Email (required)" });
    expect(email.closest("[data-slot=field]")).toContainElement(refusal);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("an_input_that_is_not_json_is_refused_before_anything_is_sent", () => {
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={[]}
        currentVersion="1.0.0"
        inputSchema={null}
      />,
    );
    openWith("{ not json");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(startAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("the run dialog's versions", () => {
  beforeEach(() => {
    visit("/workflows/sales/route-lead");
    startAction.mockReset();
  });

  it("the_start_flag_in_the_address_opens_it_and_closing_takes_the_flag_away", () => {
    visit("/workflows/sales/route-lead?start=1");
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={["1.0.0"]}
        currentVersion="1.0.0"
        inputSchema={null}
      />,
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(window.location.search).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a_row_button_opens_it_on_its_version_and_gets_the_focus_back", async () => {
    render(
      <>
        <StartDialog
          namespace="sales"
          name="route-lead"
          title="Route a lead"
          versions={["1.1.0", "1.0.0"]}
          currentVersion="1.1.0"
          inputSchema={null}
        />
        <RunVersionButton version="1.0.0" label="Run 1.0.0" />
      </>,
    );

    const row = screen.getByRole("button", { name: "Run 1.0.0" });
    row.focus();
    fireEvent.click(row);
    const version = screen.getByRole("combobox", { name: "Version" });
    expect(version).toHaveTextContent("1.0.0");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run 1.0.0" })).toHaveFocus();
    });
  });

  it("the_current_version_is_named_and_chosen_and_takes_focus", () => {
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={["1.1.0", "1.0.0"]}
        currentVersion="1.1.0"
        inputSchema={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    const version = screen.getByRole("combobox", { name: "Version" });
    expect(version).toHaveTextContent("1.1.0 (current)");
    expect(version).toHaveFocus();
  });

  it("a_chosen_earlier_version_runs_by_its_number", async () => {
    startAction.mockResolvedValue({ ok: true, value: { id: "run-2" } });
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        title="Route a lead"
        versions={["1.1.0", "1.0.0"]}
        currentVersion="1.1.0"
        inputSchema={null}
        chosen="1.0.0"
        label="Run this version"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run this version" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(startAction).toHaveBeenCalledWith(
        "sales",
        "route-lead",
        "1.0.0",
        {},
        expect.any(String),
      );
    });
  });
});
