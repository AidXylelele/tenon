import { describe, expect, it } from "vitest";
import {
  fitOf,
  fitWidthOf,
  isLargestZoom,
  isSmallestZoom,
  zoomInOf,
  zoomOutOf,
} from "./zoom";

describe("the zoom the canvas opens at", () => {
  it("is_full_size_when_the_flow_fits_the_width", () => {
    const flow = { width: 600, height: 2000 };
    const view = { width: 800, height: 600 };

    const zoom = fitWidthOf(flow, view);

    expect(zoom).toBe(1);
  });

  it("fits_the_width_when_the_flow_is_wider_and_scrolls_down", () => {
    const flow = { width: 1200, height: 2000 };
    const view = { width: 600, height: 600 };

    const zoom = fitWidthOf(flow, view);

    expect(zoom).toBe(0.5);
  });

  it("is_never_below_a_quarter", () => {
    const flow = { width: 10_000, height: 800 };
    const view = { width: 600, height: 600 };

    const zoom = fitWidthOf(flow, view);

    expect(zoom).toBe(0.25);
  });
});

describe("fitting the flow to the view", () => {
  it("shows_all_of_it", () => {
    const flow = { width: 1200, height: 1600 };
    const view = { width: 600, height: 600 };

    const zoom = fitOf(flow, view);

    expect(zoom).toBe(0.375);
  });

  it("never_zooms_above_full_size", () => {
    const flow = { width: 300, height: 200 };
    const view = { width: 800, height: 600 };

    const zoom = fitOf(flow, view);

    expect(zoom).toBe(1);
  });
});

describe("zooming in and out", () => {
  it.each([
    ["in_from_full_size", zoomInOf, 1, 1.25],
    ["in_stops_at_one_and_a_half", zoomInOf, 1.25, 1.5],
    ["out_from_full_size", zoomOutOf, 1, 0.8],
    ["out_stops_at_a_quarter", zoomOutOf, 0.3, 0.25],
  ] as const)("%s", (_, step, from, to) => {
    const zoom = step(from);

    expect(zoom).toBe(to);
  });
});

describe("the bounds of the zoom", () => {
  it.each([
    ["a_quarter_is_the_smallest", isSmallestZoom, 0.25, true],
    ["full_size_is_not_the_smallest", isSmallestZoom, 1, false],
    ["one_and_a_half_is_the_largest", isLargestZoom, 1.5, true],
    ["full_size_is_not_the_largest", isLargestZoom, 1, false],
  ] as const)("%s", (_, bound, zoom, reached) => {
    const answer = bound(zoom);

    expect(answer).toBe(reached);
  });
});
