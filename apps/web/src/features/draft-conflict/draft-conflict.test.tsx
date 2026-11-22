import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftConflict } from "./draft-conflict";

const THEIRS = "document:\n  name: leads\ndo:\n  - fetch:\n      call: grpc\n";
const MINE = "document:\n  name: leads\ndo:\n  - fetch:\n      call: openapi\n";

describe("a draft saved by someone else meanwhile", () => {
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
