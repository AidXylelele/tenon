import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { ON_CALL_DETAIL } from "../../__shared_context/connections.test-support";
import { RUN_EVENTS } from "../../__shared_context/run-events.test-support";
import { NotificationPage } from "./notification-page";

const { deleteSubscriptionAction } = vi.hoisted(() => ({
  deleteSubscriptionAction: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./actions", () => ({ deleteSubscriptionAction }));

function show() {
  render(
    <TooltipProvider>
      <NotificationPage subscription={ON_CALL_DETAIL} runEvents={RUN_EVENTS} />
    </TooltipProvider>,
  );
}

describe("a notification's page", () => {
  it("says_what_it_sends_and_lists_the_deliveries", () => {
    show();

    expect(screen.getByText("A run fails")).toBeVisible();
    expect(screen.getByText("None")).toBeVisible();
    expect(screen.getByText("Delivered")).toBeVisible();
    expect(screen.getByText("The address answered 503")).toBeVisible();
  });

  it("deleting_asks_first_and_shows_a_refusal_in_the_dialog", async () => {
    deleteSubscriptionAction.mockResolvedValue({
      ok: false,
      problem: {
        type: "about:blank",
        title: "Tenon is not answering",
        status: 503,
        detail: "Tenon is not answering; try again in a moment",
        errors: [],
      },
    });
    show();

    const more = screen.getByRole("button", { name: "More actions" });
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete notification…" }),
    );
    expect(
      await screen.findByRole("button", { name: "Keep it" }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete notification" }),
    );

    await waitFor(() => {
      expect(deleteSubscriptionAction).toHaveBeenCalledWith(ON_CALL_DETAIL.id);
    });
    expect(
      await screen.findByText("Tenon is not answering; try again in a moment"),
    ).toBeVisible();
  });
});
