import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionEditor } from "./subscription-editor";

const { createSubscriptionAction, push } = vi.hoisted(() => ({
  createSubscriptionAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("./actions", () => ({ createSubscriptionAction }));

const FAILS = "org.open-workflow-specification.workflow.faulted.v1";
const PRESETS = [{ label: "A run fails", value: FAILS }];

function fillIn() {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: " On-call " },
  });
  fireEvent.change(screen.getByLabelText("Address"), {
    target: { value: "https://hooks.example.com/on-call" },
  });
}

function refusal(code: string, pointer: string, detail: string) {
  return {
    ok: false,
    problem: {
      type: `urn:problem:${code}`,
      title: "Refused",
      status: 422,
      detail,
      errors: [{ pointer, detail }],
    },
  };
}

describe("a new notification", () => {
  beforeEach(() => {
    createSubscriptionAction.mockReset();
    push.mockReset();
  });

  it("a_failed_run_is_the_default_and_opens_the_new_notification", async () => {
    createSubscriptionAction.mockResolvedValue({
      ok: true,
      value: { id: "n-1", name: "On-call" },
    });
    render(<SubscriptionEditor secretNames={[]} presets={PRESETS} />);
    fillIn();

    fireEvent.click(
      screen.getByRole("button", { name: "Create notification" }),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/notifications/n-1");
    });
    expect(createSubscriptionAction).toHaveBeenCalledWith(
      "On-call",
      { uri: "https://hooks.example.com/on-call" },
      { with: { type: FAILS } },
    );
  });

  it("an_event_type_of_ones_own_and_more_attributes_are_matched", async () => {
    createSubscriptionAction.mockResolvedValue({
      ok: true,
      value: { id: "n-2", name: "On-call" },
    });
    render(<SubscriptionEditor secretNames={[]} presets={PRESETS} />);
    fillIn();

    fireEvent.click(screen.getByLabelText("An event of a type I choose"));
    fireEvent.change(screen.getByLabelText("Event type"), {
      target: { value: "com.example.order.paid" },
    });
    fireEvent.click(screen.getByRole("button", { name: /More options/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add an attribute to match" }),
    );
    fireEvent.change(screen.getByLabelText("source matches"), {
      target: { value: "/sales" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create notification" }),
    );

    await waitFor(() => {
      expect(createSubscriptionAction).toHaveBeenCalledWith(
        "On-call",
        expect.anything(),
        { with: { type: "com.example.order.paid", source: "/sales" } },
      );
    });
  });

  it("data_that_is_not_an_object_is_refused_beside_its_row", () => {
    render(<SubscriptionEditor secretNames={[]} presets={PRESETS} />);
    fillIn();

    fireEvent.click(screen.getByRole("button", { name: /More options/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add an attribute to match" }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Attribute" }));
    fireEvent.click(screen.getByRole("option", { name: "data" }));
    fireEvent.change(screen.getByLabelText("data matches"), {
      target: { value: "[1]" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create notification" }),
    );

    expect(screen.getByText(/JSON object it must contain/)).toBeVisible();
    expect(createSubscriptionAction).not.toHaveBeenCalled();
  });

  it("a_private_address_is_refused_beside_the_address", async () => {
    createSubscriptionAction.mockResolvedValue(
      refusal(
        "subscription.private-endpoint",
        "/endpoint/uri",
        "Private networks are refused.",
      ),
    );
    render(<SubscriptionEditor secretNames={[]} presets={PRESETS} />);
    fillIn();

    fireEvent.click(
      screen.getByRole("button", { name: "Create notification" }),
    );

    const address = screen.getByLabelText("Address");
    await waitFor(() => {
      expect(address).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("authentication_without_secrets_links_to_a_new_secret", () => {
    render(<SubscriptionEditor secretNames={[]} presets={PRESETS} />);

    fireEvent.click(screen.getByRole("combobox", { name: /Authentication/ }));
    fireEvent.click(
      screen.getByRole("option", { name: "Bearer token, from a secret" }),
    );

    const add = screen.getByRole("link", { name: "Add one" });
    expect(add).toHaveAttribute("href", "/secrets?new=1");
  });
});
