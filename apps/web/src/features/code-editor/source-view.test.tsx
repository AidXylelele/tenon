import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceView } from "./source-view";

const TEXT = "document:\n  name: digest\n";

describe("a version's text, read only", () => {
  it("shows_the_text_under_its_name", () => {
    render(<SourceView text={TEXT} label="Version text" />);

    const content = screen.getByRole("textbox", { name: "Version text" });
    expect(content).toHaveTextContent("name: digest");
  });

  it("cannot_be_edited", () => {
    render(<SourceView text={TEXT} label="Version text" />);

    const content = screen.getByRole("textbox", { name: "Version text" });
    expect(content).toHaveAttribute("contenteditable", "false");
  });

  it("wraps_long_lines", () => {
    const { container } = render(
      <SourceView text={TEXT} label="Version text" />,
    );

    const wrapping = container.querySelector(".cm-lineWrapping");
    expect(wrapping).not.toBeNull();
  });
});
