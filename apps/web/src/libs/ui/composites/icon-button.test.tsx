import { fireEvent, render, screen } from "@testing-library/react";
import { ZoomInIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../components/tooltip";
import { IconButton } from "./icon-button";

function drawn(onClick = vi.fn()) {
  const button = (
    <IconButton label="Zoom in" icon={ZoomInIcon} onClick={onClick} />
  );

  return render(<TooltipProvider delayDuration={0}>{button}</TooltipProvider>);
}

describe("an icon button", () => {
  it("is_named_by_its_label", () => {
    drawn();

    const button = screen.getByRole("button", { name: "Zoom in" });

    expect(button).toBeInTheDocument();
  });

  it("shows_the_same_words_in_its_tooltip_on_focus", async () => {
    drawn();
    const button = screen.getByRole("button", { name: "Zoom in" });

    fireEvent.focus(button);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Zoom in");
  });

  it("presses_like_a_button", () => {
    const onClick = vi.fn();
    drawn(onClick);
    const button = screen.getByRole("button", { name: "Zoom in" });

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("hides_its_icon_from_assistive_technology", () => {
    drawn();
    const button = screen.getByRole("button", { name: "Zoom in" });

    const icon = button.querySelector("svg");

    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
