import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { WEBHOOKS } from "../../__shared_context/connections.test-support";
import { WebhooksPage, type WebhooksPageProps } from "./webhooks-page";

const { sendEventAction, createWebhookAction, success } = vi.hoisted(() => ({
  sendEventAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createWebhookAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success } }));
vi.mock("./actions", () => ({
  sendEventAction,
  createWebhookAction,
  deleteWebhookAction: vi.fn(),
}));

const PAGE: WebhooksPageProps = {
  webhooks: WEBHOOKS,
  testing: false,
  creating: false,
};

function show(props: Partial<WebhooksPageProps> = {}) {
  render(
    <TooltipProvider>
      <WebhooksPage {...PAGE} {...props} />
    </TooltipProvider>,
  );
}

describe("the webhooks page", () => {
  beforeEach(() => {
    sendEventAction.mockReset();
    createWebhookAction.mockReset();
    success.mockReset();
  });

  it("lists_each_webhook_by_name_and_event_type", () => {
    show();

    expect(screen.getByText("Order approvals")).toBeVisible();
    expect(screen.getByText("com.example.order.approved.v1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Delete Order approvals" }),
    ).toBeVisible();
  });

  it("with_no_webhook_the_empty_state_holds_the_one_create_action", () => {
    show({ webhooks: [] });

    const creates = screen.getAllByRole("button", { name: "New webhook" });
    expect(creates).toHaveLength(1);
    expect(screen.getByText("No webhooks yet")).toBeVisible();
  });

  it("the_test_address_opens_the_test_event_with_the_first_webhook_type", () => {
    show({ testing: true });

    const type = screen.getByRole("combobox", { name: "Event type" });
    expect(type).toHaveValue("com.example.order.approved.v1");
    expect(type).toHaveFocus();
  });

  it("a_sent_test_event_closes_and_says_where_to_look", async () => {
    sendEventAction.mockResolvedValue({ ok: true, value: undefined });
    show({ testing: true });

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
    show({ testing: true });

    fireEvent.change(screen.getByLabelText(/^Data/), {
      target: { value: "{ nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send event" }));

    expect(screen.getByText(/This is not JSON/)).toBeVisible();
    expect(sendEventAction).not.toHaveBeenCalled();
  });

  it("the_new_address_opens_the_create_form", () => {
    show({ creating: true });

    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toBeVisible();
  });
});
