import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/dialog";
import { Announcer, useAnnounce } from "./announcer";

function AddStep() {
  const announce = useAnnounce();

  return (
    <button
      type="button"
      onClick={() => {
        announce("Step added");
      }}
    >
      Add a step
    </button>
  );
}

function Console() {
  return (
    <Announcer>
      <AddStep />
    </Announcer>
  );
}

describe("the console's announcer", () => {
  it("it_waits_silently_until_something_happens", () => {
    render(<Console />);

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("");
  });

  it("an_outcome_is_read_out_politely", () => {
    render(<Console />);
    const add = screen.getByRole("button", { name: "Add a step" });

    act(() => {
      fireEvent.click(add);
    });

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Step added");
  });

  it("the_same_outcome_twice_is_read_out_again_as_new_text", () => {
    render(<Console />);
    const add = screen.getByRole("button", { name: "Add a step" });
    const region = screen.getByRole("status");
    act(() => {
      fireEvent.click(add);
    });
    const first = region.firstElementChild;

    act(() => {
      fireEvent.click(add);
    });

    const second = region.firstElementChild;
    expect(second).toHaveTextContent("Step added");
    expect(second).not.toBe(first);
  });

  it("an_open_dialog_leaves_the_region_heard", () => {
    render(
      <Announcer>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Add a step</DialogTitle>
            <DialogDescription>After Fetch invoices</DialogDescription>
            <AddStep />
          </DialogContent>
        </Dialog>
      </Announcer>,
    );

    const region = screen.getByRole("status");

    const hiddenBy = region.closest('[aria-hidden="true"]');
    expect(hiddenBy).toBeNull();
  });

  it("asking_to_announce_outside_the_announcer_is_refused", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const rendering = () => render(<AddStep />);

    expect(rendering).toThrow(
      new Error("useAnnounce must be used within an Announcer."),
    );
  });
});
