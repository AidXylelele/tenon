import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrashIcon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Outcome } from "@/libs/data-access/problem";
import { TooltipProvider } from "../components/tooltip";
import { ConfirmAction } from "./confirm-action";

const { toastSuccess } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess },
}));

const REFUSED: Outcome<void> = {
  ok: false,
  problem: {
    type: "urn:problem:secret.in-use",
    title: "The secret is in use",
    status: 409,
    detail: "A running workflow uses it",
    errors: [],
    retryAfter: null,
  },
};

function renderDelete(
  action: () => Promise<Outcome<void>>,
  onDone?: () => void,
) {
  return render(
    <TooltipProvider>
      <ConfirmAction
        icon={<TrashIcon />}
        label="Delete stripe-key"
        size="icon-sm"
        title="Delete stripe-key?"
        description="Runs that need it fail."
        actionLabel="Delete"
        action={action}
        success="stripe-key deleted"
        onDone={onDone}
      />
    </TooltipProvider>,
  );
}

describe("an action that asks first", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it("asks_with_what_it_changes_and_keeping_it_does_nothing", () => {
    const action = vi.fn();
    renderDelete(action);

    fireEvent.click(screen.getByRole("button", { name: "Delete stripe-key" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete stripe-key?",
    });
    expect(dialog).toHaveAccessibleDescription("Runs that need it fail.");
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("acts_once_confirmed_says_it_is_done_and_hands_back_to_the_page", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const onDone = vi.fn();
    renderDelete(action, onDone);

    fireEvent.click(screen.getByRole("button", { name: "Delete stripe-key" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("stripe-key deleted");
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a_refusal_says_why_in_the_dialog_and_keeps_it_open", async () => {
    const action = vi.fn().mockResolvedValue(REFUSED);
    renderDelete(action);

    fireEvent.click(screen.getByRole("button", { name: "Delete stripe-key" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("A running workflow uses it"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("cannot_be_confirmed_again_while_it_acts", async () => {
    let finish: (outcome: Outcome<void>) => void = () => undefined;
    const pending = new Promise<Outcome<void>>((resolve) => {
      finish = resolve;
    });
    renderDelete(() => pending);

    fireEvent.click(screen.getByRole("button", { name: "Delete stripe-key" }));
    const confirm = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    finish({ ok: true, value: undefined });

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  it("a_button_with_a_size_of_its_own_shows_its_label", () => {
    render(
      <ConfirmAction
        icon={<TrashIcon />}
        label="Archive"
        title="Archive route-lead?"
        description="It starts no run."
        actionLabel="Archive"
        action={vi.fn()}
        success="route-lead archived"
      />,
    );

    expect(screen.getByRole("button", { name: "Archive" })).toHaveTextContent(
      "Archive",
    );
  });
});

describe("an action that asks first, opened from elsewhere", () => {
  it("shows_no_button_of_its_own_and_reports_closing", () => {
    const changed = vi.fn();
    render(
      <TooltipProvider>
        <ConfirmAction
          icon={<TrashIcon />}
          label="Delete run"
          title="Delete this run?"
          description="It cannot be undone."
          actionLabel="Delete run"
          action={vi.fn()}
          success="Run deleted"
          open
          onOpenChange={changed}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("alertdialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(changed).toHaveBeenCalledWith(false);
  });
});
