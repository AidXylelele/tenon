import { render, screen } from "@testing-library/react";
import { CircleXIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Status, type StatusLook } from "./status";

const FAULTED: StatusLook = {
  tone: "danger",
  icon: CircleXIcon,
  label: "Faulted",
};

describe("a state shown as its icon and its word", () => {
  it("the_word_is_read_and_the_icon_is_hidden_from_assistive_technologies", () => {
    const { container } = render(<Status look={FAULTED} />);
    const icon = container.querySelector("svg");
    const word = screen.getByText("Faulted");

    expect(word).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
