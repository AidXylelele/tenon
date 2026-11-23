import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Controls } from "./controls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({
  controlAction: vi.fn(),
  deleteAction: vi.fn(),
  restartAction: vi.fn(),
}));

describe("the controls of a run", () => {
  it("offer_only_what_the_platform_allows_now", () => {
    render(<Controls id="r1" controls={["suspend", "cancel"]} />);

    const buttons = screen
      .getAllByRole("button")
      .map((each) => each.textContent);

    expect(buttons).toEqual(["Pause", "Cancel run"]);
  });

  it("an_ended_run_is_run_again_or_deleted", () => {
    render(<Controls id="r1" controls={["restart", "delete"]} />);

    const buttons = screen
      .getAllByRole("button")
      .map((each) => each.textContent);

    expect(buttons).toEqual(["Run again", "Delete run"]);
  });
});
