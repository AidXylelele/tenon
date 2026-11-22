import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Disclosure } from "./disclosure";

function MoreOptions({
  defaultOpen = false,
}: {
  readonly defaultOpen?: boolean;
}) {
  return (
    <Disclosure
      title="More options"
      summary="Waits for the result"
      defaultOpen={defaultOpen}
    >
      <p>Environment variables</p>
    </Disclosure>
  );
}

describe("a disclosure of rarely needed fields", () => {
  it("closed_it_shows_its_title_and_summary_and_hides_its_fields", () => {
    render(<MoreOptions />);

    const header = screen.getByRole("button", {
      name: "More options",
      description: "Waits for the result",
    });
    const fields = screen.queryByText("Environment variables");
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(fields).not.toBeInTheDocument();
  });

  it("pressing_its_header_shows_the_fields_it_controls", () => {
    render(<MoreOptions />);
    const header = screen.getByRole("button", { name: "More options" });

    act(() => {
      fireEvent.click(header);
    });

    const fields = screen.getByText("Environment variables");
    const controlled = header.getAttribute("aria-controls") ?? "";
    const region = document.getElementById(controlled);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(region).toContainElement(fields);
  });

  it("pressing_it_again_hides_the_fields", () => {
    render(<MoreOptions defaultOpen />);
    const header = screen.getByRole("button", { name: "More options" });

    act(() => {
      fireEvent.click(header);
    });

    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("an_owner_holding_it_is_told_when_it_is_pressed", () => {
    const onOpenChange = vi.fn();
    render(
      <Disclosure
        title="If this step fails"
        open={false}
        onOpenChange={onOpenChange}
      >
        <p>Retry</p>
      </Disclosure>,
    );
    const header = screen.getByRole("button", { name: "If this step fails" });

    act(() => {
      fireEvent.click(header);
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
