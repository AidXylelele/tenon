import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { FlowCanvas } from "./flow-canvas";

interface Layout {
  readonly content: { readonly width: number; readonly height: number };
  readonly view: { readonly width: number; readonly height: number };
}

const WIDE: Layout = {
  content: { width: 1200, height: 1600 },
  view: { width: 600, height: 600 },
};

const NARROW: Layout = {
  content: { width: 300, height: 400 },
  view: { width: 600, height: 600 },
};

let observed: (() => void) | null = null;

class RecordingResizeObserver {
  constructor(callback: () => void) {
    observed = callback;
  }
  observe = () => undefined;
  disconnect = () => undefined;
}

function laidOut(layout: Layout) {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
    layout.content.width,
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
    layout.content.height,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    layout.view.width,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    layout.view.height,
  );
}

function drawn(focusable = false, description?: string) {
  const canvas = (
    <FlowCanvas
      label="The workflow's flow"
      description={description}
      focusable={focusable}
    >
      <p>Inside</p>
    </FlowCanvas>
  );

  return render(<TooltipProvider>{canvas}</TooltipProvider>);
}

function scaleOf(): string {
  const inside = screen.getByText("Inside");
  const scaled = inside.parentElement;

  return scaled?.style.transform ?? "";
}

function press(name: string) {
  const button = screen.getByRole("button", { name });
  fireEvent.click(button);
}

describe("a flow canvas", () => {
  beforeEach(() => {
    observed = null;
    vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is_a_region_named_for_what_it_shows", () => {
    drawn();

    const region = screen.getByRole("region", { name: "The workflow's flow" });

    const inside = screen.getByText("Inside");
    expect(region).toContainElement(inside);
  });

  it("says_how_to_move_inside_it", () => {
    drawn(false, "The arrow keys move between the steps.");

    const region = screen.getByRole("region", { name: "The workflow's flow" });

    expect(region).toHaveAccessibleDescription(
      "The arrow keys move between the steps.",
    );
  });

  it("is_a_tab_stop_of_its_own_when_nothing_inside_takes_focus", () => {
    drawn(true);

    const region = screen.getByRole("region", { name: "The workflow's flow" });

    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("leaves_the_tab_stop_to_its_content_otherwise", () => {
    drawn(false);

    const region = screen.getByRole("region", { name: "The workflow's flow" });

    expect(region).not.toHaveAttribute("tabindex");
  });

  it("opens_fitted_to_its_width_when_the_content_is_wider", () => {
    laidOut(WIDE);

    drawn();

    const scale = scaleOf();

    expect(scale).toBe("scale(0.5)");
  });

  it("opens_at_full_size_when_the_content_fits", () => {
    laidOut(NARROW);

    drawn();

    const scale = scaleOf();

    expect(scale).toBe("scale(1)");
  });

  it("keeps_the_scrolling_area_as_large_as_the_scaled_content", () => {
    laidOut(WIDE);

    drawn();

    const scaled = screen.getByText("Inside").parentElement;
    const sizer = scaled?.parentElement;
    expect(sizer?.style.width).toBe("600px");
    expect(sizer?.style.height).toBe("800px");
  });

  it("zooms_in_and_out_by_a_quarter", () => {
    laidOut(NARROW);
    drawn();

    press("Zoom in");
    const zoomedIn = scaleOf();
    press("Zoom out");
    press("Zoom out");

    expect(zoomedIn).toBe("scale(1.25)");
    const scale = scaleOf();
    expect(scale).toBe("scale(0.8)");
  });

  it("fits_all_of_the_content_never_above_full_size", () => {
    laidOut(WIDE);
    drawn();

    press("Fit the flow to the view");

    const scale = scaleOf();

    expect(scale).toBe("scale(0.375)");
  });

  it("stops_zooming_in_at_one_and_a_half", () => {
    laidOut(NARROW);
    drawn();

    press("Zoom in");
    press("Zoom in");
    press("Zoom in");

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const scale = scaleOf();
    expect(scale).toBe("scale(1.5)");
    expect(zoomIn).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps_its_zoom_when_the_content_grows_later", () => {
    laidOut(NARROW);
    drawn();
    press("Zoom in");
    laidOut(WIDE);

    act(() => {
      observed?.();
    });

    const scale = scaleOf();

    expect(scale).toBe("scale(1.25)");
  });

  it("does_not_scale_content_it_cannot_measure", () => {
    drawn();

    press("Fit the flow to the view");

    const scale = scaleOf();

    expect(scale).toBe("");
  });
});
