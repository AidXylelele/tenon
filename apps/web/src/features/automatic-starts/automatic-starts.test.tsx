import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Outcome } from "@/libs/data-access/problem";
import { AutomaticStarts } from "./automatic-starts";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const DONE: Outcome<void> = { ok: true, value: undefined };

const REFUSED: Outcome<void> = {
  ok: false,
  problem: {
    type: "about:blank",
    title: "Not published",
    status: 409,
    detail: "Nothing is published yet",
    errors: [],
    retryAfter: null,
  },
};

describe("a workflow's automatic starts", () => {
  it("with_its_label_it_names_what_it_switches_and_its_state", () => {
    render(
      <AutomaticStarts workflow="Daily digest" on turn={vi.fn()} labelled />,
    );

    const toggle = screen.getByRole("switch", { name: "Starts automatically" });

    expect(toggle).toBeChecked();
    expect(screen.getByText("On")).toBeVisible();
  });

  it("in_a_table_it_is_named_by_its_workflow", () => {
    render(<AutomaticStarts workflow="Daily digest" on turn={vi.fn()} />);

    const toggle = screen.getByRole("switch", {
      name: "Daily digest starts automatically",
    });

    expect(toggle).toBeChecked();
  });

  it("turning_off_confirms_with_undo", async () => {
    const turn = vi.fn(() => Promise.resolve(DONE));
    render(<AutomaticStarts workflow="Daily digest" on turn={turn} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Automatic starts turned off for Daily digest",
        expect.objectContaining({ duration: Infinity }),
      );
    });
    expect(turn).toHaveBeenCalledWith(false);
  });

  it("a_refusal_is_said_beside_the_switch", async () => {
    const turn = vi.fn(() => Promise.resolve(REFUSED));
    render(<AutomaticStarts workflow="Daily digest" on turn={turn} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nothing is published yet",
    );
  });
});
