import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";
import { fakeViewport } from "./viewport.test-support";

function Probe() {
  const mobile = useIsMobile();
  return <span>{mobile ? "sheet" : "column"}</span>;
}

describe("the layout the sidebar takes at a viewport's width", () => {
  it.each([
    [1023, "sheet"],
    [1024, "column"],
    [1440, "column"],
  ])("at_%i_px_the_sidebar_is_a_%s", (width, layout) => {
    const viewport = fakeViewport(width);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(<Probe />);

    const shown = screen.getByText(layout);
    expect(shown).toBeInTheDocument();
  });

  it("narrowing_the_window_below_1024_px_turns_the_column_into_a_sheet", () => {
    const viewport = fakeViewport(1280);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Probe />);

    act(() => {
      viewport.resize(800);
    });

    const shown = screen.getByText("sheet");
    expect(shown).toBeInTheDocument();
  });

  it("the_server_renders_the_column", () => {
    const viewport = fakeViewport(800);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    const html = renderToString(<Probe />);

    expect(html).toBe("<span>column</span>");
  });
});
