import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasLoading } from "./canvas-loading";

describe("a canvas page that is still loading", () => {
  it("says_it_is_loading", () => {
    render(<CanvasLoading />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
  });
});
