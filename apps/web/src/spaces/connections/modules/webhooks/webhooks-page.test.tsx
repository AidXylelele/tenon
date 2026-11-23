import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { visit } from "@/libs/routing/navigation.test-support";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { WEBHOOKS } from "../../__shared_context/connections.test-support";
import { WebhooksPage, type WebhooksPageProps } from "./webhooks-page";

const { sendEventAction, createWebhookAction, success } = vi.hoisted(() => ({
  sendEventAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createWebhookAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success } }));
vi.mock(
  "next/navigation",
  () => import("@/libs/routing/navigation.test-support"),
);
vi.mock("./actions", () => ({
  sendEventAction,
  createWebhookAction,
  deleteWebhookAction: vi.fn(),
}));

const PAGE: WebhooksPageProps = { webhooks: WEBHOOKS };

function show(props: Partial<WebhooksPageProps> = {}) {
  render(
    <TooltipProvider>
      <WebhooksPage {...PAGE} {...props} />
    </TooltipProvider>,
  );
}

describe("the webhooks page", () => {
  beforeEach(() => {
    visit("/webhooks");
    sendEventAction.mockReset();
    createWebhookAction.mockReset();
    success.mockReset();
  });

  it("lists_each_webhook_by_name_and_event_type", () => {
    show();

    expect(screen.getByText("Order approvals")).toBeVisible();
    expect(screen.getByText("com.example.order.approved.v1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Actions for Order approvals" }),
    ).toBeVisible();
  });

  it("with_no_webhook_the_empty_state_holds_the_one_create_action", () => {
    show({ webhooks: [] });

    const creates = screen.getAllByRole("button", { name: "New webhook" });
    expect(creates).toHaveLength(1);
    expect(screen.getByText("No webhooks yet")).toBeVisible();
  });

  it("the_test_address_opens_the_test_event_with_the_first_webhook_type", () => {
    visit("/webhooks?test=1");
    show();

    const type = screen.getByRole("combobox", { name: /Event type/ });
    expect(type).toHaveTextContent("com.example.order.approved.v1");
    expect(type).toHaveFocus();
  });

  it("another_type_can_be_typed_into_the_picker", () => {
    visit("/webhooks?test=1");
    show();

    fireEvent.click(screen.getByRole("combobox", { name: /Event type/ }));
    fireEvent.change(
      screen.getByPlaceholderText("Find or type an event type"),
      {
        target: { value: "com.example.custom" },
      },
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Use “com.example.custom”" }),
    );

    expect(
      screen.getByRole("combobox", { name: /Event type/ }),
    ).toHaveTextContent("com.example.custom");
  });

  it("closing_the_test_event_takes_its_flag_out_of_the_address", () => {
    visit("/webhooks?test=1");
    show();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(window.location.search).toBe("");
  });

  it("keep_it_gives_the_focus_back_to_the_row_actions", async () => {
    show();

    const more = screen.getByRole("button", {
      name: "Actions for Order approvals",
    });
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep it" }));

    await waitFor(() => {
      expect(more).toHaveFocus();
    });
  });

  it("a_sent_test_event_closes_and_says_where_to_look", async () => {
    sendEventAction.mockResolvedValue({ ok: true, value: undefined });
    visit("/webhooks?test=1");
    show();

    fireEvent.click(screen.getByRole("button", { name: "Send event" }));

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith(
        "Test event com.example.order.approved.v1 sent",
        expect.anything(),
      );
    });
    const sent = sendEventAction.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      specversion: "1.0",
      type: "com.example.order.approved.v1",
      data: { orderId: 1, total: 42 },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("data_that_is_not_json_is_refused_beside_its_field", () => {
    visit("/webhooks?test=1");
    show();

    fireEvent.change(screen.getByLabelText(/^Data/), {
      target: { value: "{ nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send event" }));

    expect(screen.getByText(/This is not JSON/)).toBeVisible();
    expect(sendEventAction).not.toHaveBeenCalled();
  });

  it("the_new_address_opens_the_create_form", () => {
    visit("/webhooks?new=1");
    show();

    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toBeVisible();
  });
});
