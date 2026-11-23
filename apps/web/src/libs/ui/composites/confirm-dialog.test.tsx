import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrashIcon } from "lucide-react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Outcome } from "@/libs/data-access/problem";
import { ConfirmDialog } from "./confirm-dialog";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const DONE: Outcome<void> = { ok: true, value: undefined };

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

function Opener({ action }: { readonly action: () => Promise<Outcome<void>> }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const after = useRef<HTMLHeadingElement>(null);

  return (
    <>
      <h1 ref={after} tabIndex={-1}>
        Secrets
      </h1>
      <button
        ref={opener}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        More actions
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete stripe-key?"
        description="Runs that need it fail."
        actionLabel="Delete secret"
        icon={<TrashIcon />}
        action={action}
        success="stripe-key deleted"
        returnFocus={() => opener.current}
        doneFocus={() => after.current}
      />
    </>
  );
}

describe("a controlled confirmation", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it("keep_it_has_the_focus_on_open", () => {
    render(<Opener action={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus();
  });

  it("keep_it_closes_and_gives_the_focus_back_to_the_opener", async () => {
    const action = vi.fn();
    render(<Opener action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "More actions" }),
      ).toHaveFocus();
    });
    expect(action).not.toHaveBeenCalled();
  });

  it("a_done_action_confirms_and_moves_the_focus_to_a_stable_place", async () => {
    render(<Opener action={() => Promise.resolve(DONE)} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete secret" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Secrets" })).toHaveFocus();
    });
    expect(toastSuccess).toHaveBeenCalledWith("stripe-key deleted");
  });

  it("a_refusal_stays_in_the_dialog", async () => {
    render(<Opener action={() => Promise.resolve(REFUSED)} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete secret" }));

    expect(await screen.findByText("A running workflow uses it")).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
