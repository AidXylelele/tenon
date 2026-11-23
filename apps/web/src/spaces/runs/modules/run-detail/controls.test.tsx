import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Controls } from "./controls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({
  controlAction: vi.fn(),
  deleteAction: vi.fn(),
  restartAction: vi.fn(),
}));

function shownButtons(): (string | null)[] {
  return screen
    .getAllByRole("button")
    .map((each) => each.getAttribute("aria-label") ?? each.textContent);
}

function openMenu(): HTMLElement {
  const more = screen.getByRole("button", { name: "More actions" });
  fireEvent.keyDown(more, { key: "Enter" });
  return screen.getByRole("menu", { name: "More actions" });
}

function itemsOf(menu: HTMLElement): (string | null)[] {
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
  return items.map((item) => item.textContent);
}

describe("the controls of a run", () => {
  it("a_running_run_keeps_pause_and_cancel_under_more_actions", () => {
    render(<Controls id="r1" controls={["suspend", "cancel"]} />);

    const menu = openMenu();

    expect(itemsOf(menu)).toEqual(["Pause", "Cancel run…", "Copy run ID"]);
  });

  it("a_paused_run_is_resumed_from_its_header", () => {
    render(<Controls id="r1" controls={["resume", "cancel"]} />);

    expect(shownButtons()).toEqual(["Resume", "More actions"]);
  });

  it("an_ended_run_is_run_again_or_deleted_from_more_actions", () => {
    render(<Controls id="r1" controls={["restart", "delete"]} />);

    const shown = shownButtons();
    const menu = openMenu();

    expect(shown).toEqual(["Run again", "More actions"]);
    expect(itemsOf(menu)).toEqual(["Copy run ID", "Delete run…"]);
  });

  it("delete_asks_first", () => {
    render(<Controls id="r1" controls={["restart", "delete"]} />);

    const menu = openMenu();
    const remove = Array.from(menu.querySelectorAll('[role="menuitem"]')).at(
      -1,
    );

    if (remove === undefined) throw new Error("No delete item");

    fireEvent.click(remove);

    expect(
      screen.getByRole("alertdialog", { name: "Delete this run?" }),
    ).toBeInTheDocument();
  });
});
