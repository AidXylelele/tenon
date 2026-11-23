import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasFrame } from "./canvas-frame";

describe("the frame of a canvas page", () => {
  it("marks_itself_so_the_console_gives_it_the_whole_height", () => {
    render(
      <CanvasFrame>
        <p>Flow</p>
      </CanvasFrame>,
    );

    const frame = screen.getByText("Flow").parentElement;
    expect(frame).toHaveAttribute("data-frame", "canvas");
  });
});
