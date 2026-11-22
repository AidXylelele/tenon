import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

let width = 1440;
const listeners = new Set<() => void>();

function matchesAt(query: string): boolean {
  const match = /max-width: (\d+)px/.exec(query);
  const widest = Number(match?.[1]);
  return width <= widest;
}

function matchMedia(query: string) {
  return {
    get matches() {
      return matchesAt(query);
    },
    addEventListener: (_: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
}

function Probe() {
  const mobile = useIsMobile();
  return <span>{mobile ? "sheet" : "column"}</span>;
}

describe("the layout the sidebar takes at a viewport's width", () => {
  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal("matchMedia", matchMedia);
  });

  it.each([
    [1023, "sheet"],
    [1024, "column"],
    [1440, "column"],
  ])("at_%i_px_the_sidebar_is_a_%s", (viewport, layout) => {
    width = viewport;

    render(<Probe />);

    const shown = screen.getByText(layout);
    expect(shown).toBeInTheDocument();
  });

  it("narrowing_the_window_below_1024_px_turns_the_column_into_a_sheet", () => {
    width = 1280;
    render(<Probe />);

    act(() => {
      width = 800;
      listeners.forEach((listener) => {
        listener();
      });
    });

    const shown = screen.getByText("sheet");
    expect(shown).toBeInTheDocument();
  });

  it("the_server_renders_the_column", () => {
    width = 800;

    const html = renderToString(<Probe />);

    expect(html).toBe("<span>column</span>");
  });
});
