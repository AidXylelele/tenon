import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftConflict } from "./draft-conflict";

const THEIRS = "document:\n  name: leads\ndo:\n  - fetch:\n      call: grpc\n";
const MINE = "document:\n  name: leads\ndo:\n  - fetch:\n      call: openapi\n";

const BASE = "document:\n  name: leads\ndo:\n  - fetch:\n      call: http\n";
const THEIRS_APART =
  "document:\n  name: leads-2\ndo:\n  - fetch:\n      call: http\n";
const MINE_APART =
  "document:\n  name: leads\ndo:\n  - fetch:\n      call: grpc\n";

function conflict(base: string | null, mine = MINE) {
  const onResolve = vi.fn();
  render(
    <DraftConflict
      savedBy="Grace Hopper"
      savedAt="2026-11-22T10:00:00Z"
      theirs={base === null ? THEIRS : THEIRS_APART}
      base={base}
      readMine={() => mine}
      onResolve={onResolve}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
  return { onResolve };
}

async function confirmed(choice: string) {
  fireEvent.click(await screen.findByRole("button", { name: choice }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: choice }));
}

describe("a draft saved by someone else meanwhile", () => {
  it("using_theirs_after_confirming_takes_their_text", async () => {
    const { onResolve } = conflict(null);

    await confirmed("Use theirs");

    expect(onResolve).toHaveBeenCalledWith(THEIRS);
  });

  it("keeping_mine_after_confirming_takes_my_text", async () => {
    const { onResolve } = conflict(null);

    await confirmed("Keep mine");

    expect(onResolve).toHaveBeenCalledWith(MINE);
  });

  it("changes_apart_from_each_other_are_kept_both", async () => {
    const { onResolve } = conflict(BASE, MINE_APART);

    fireEvent.click(await screen.findByRole("button", { name: "Keep both" }));

    const kept = onResolve.mock.calls[0]?.[0];
    expect(kept).toContain("name: leads-2");
    expect(kept).toContain("call: grpc");
  });

  it("a_clean_merge_is_saved_as_shown", async () => {
    const { onResolve } = conflict(BASE, MINE_APART);

    fireEvent.click(await screen.findByRole("button", { name: "Save merged" }));

    const saved = onResolve.mock.calls[0]?.[0];
    expect(saved).toContain("call: grpc");
  });

  it("saving_with_changes_undecided_after_confirming_keeps_the_text_shown", async () => {
    const { onResolve } = conflict(null);

    fireEvent.click(await screen.findByRole("button", { name: "Save merged" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save merged" }),
    );

    expect(onResolve).toHaveBeenCalledWith(MINE);
  });

  it("going_back_from_saving_undecided_changes_saves_nothing", async () => {
    const { onResolve } = conflict(null);

    fireEvent.click(await screen.findByRole("button", { name: "Save merged" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("closing_the_merge_keeps_the_conflict_open", async () => {
    const { onResolve } = conflict(null);

    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Grace Hopper saved this draft");
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("saving_the_merge_with_a_change_undecided_asks_first", async () => {
    const onResolve = vi.fn();
    render(
      <DraftConflict
        savedBy="Grace Hopper"
        savedAt="2026-11-22T10:00:00Z"
        theirs={THEIRS}
        base={null}
        readMine={() => MINE}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save merged" }));

    const warning = await screen.findByText(
      /side of the change you did not decide/,
    );
    expect(warning).toBeVisible();
    expect(onResolve).not.toHaveBeenCalled();
  });
});
