import { describe, expect, it } from "vitest";
import {
  centredScrollOf,
  fitOf,
  fitWidthOf,
  isLargestZoom,
  isSmallestZoom,
  zoomInOf,
  zoomLevelOf,
  zoomOutOf,
} from "./zoom";

describe("the zoom the canvas opens at", () => {
  it("is_full_size_when_the_content_fits_the_width", () => {
    const content = { width: 600, height: 2000 };
    const view = { width: 800, height: 600 };

    const zoom = fitWidthOf(content, view);

    expect(zoom).toBe(1);
  });

  it("fits_the_width_when_the_content_is_a_little_wider", () => {
    const content = { width: 1000, height: 2000 };
    const view = { width: 800, height: 600 };

    const zoom = fitWidthOf(content, view);

    expect(zoom).toBe(0.8);
  });

  it("is_never_below_three_quarters_and_the_rest_scrolls", () => {
    const content = { width: 1200, height: 2000 };
    const view = { width: 600, height: 600 };

    const zoom = fitWidthOf(content, view);

    expect(zoom).toBe(0.75);
  });
});

describe("fitting the content to the view", () => {
  it("shows_all_of_it_when_three_quarters_are_enough", () => {
    const content = { width: 1000, height: 800 };
    const view = { width: 800, height: 800 };

    const zoom = fitOf(content, view);

    expect(zoom).toBe(0.8);
  });

  it("never_goes_below_three_quarters", () => {
    const content = { width: 1200, height: 1600 };
    const view = { width: 600, height: 600 };

    const zoom = fitOf(content, view);

    expect(zoom).toBe(0.75);
  });

  it("never_zooms_above_full_size", () => {
    const content = { width: 300, height: 200 };
    const view = { width: 800, height: 600 };

    const zoom = fitOf(content, view);

    expect(zoom).toBe(1);
  });
});

describe("zooming in and out by steps", () => {
  it.each([
    ["in_from_full_size", zoomInOf, 1, 1.25],
    ["in_from_between_steps_snaps_to_the_next", zoomInOf, 0.8, 1],
    ["in_stops_at_one_and_a_half", zoomInOf, 1.5, 1.5],
    ["out_from_full_size", zoomOutOf, 1, 0.75],
    ["out_from_between_steps_snaps_to_the_one_below", zoomOutOf, 0.8, 0.75],
    ["out_stops_at_three_quarters", zoomOutOf, 0.75, 0.75],
  ] as const)("%s", (_, step, from, to) => {
    const zoom = step(from);

    expect(zoom).toBe(to);
  });
});

describe("the bounds of the zoom", () => {
  it.each([
    ["three_quarters_is_the_smallest", isSmallestZoom, 0.75, true],
    ["full_size_is_not_the_smallest", isSmallestZoom, 1, false],
    ["one_and_a_half_is_the_largest", isLargestZoom, 1.5, true],
    ["full_size_is_not_the_largest", isLargestZoom, 1, false],
  ] as const)("%s", (_, bound, zoom, reached) => {
    const answer = bound(zoom);

    expect(answer).toBe(reached);
  });
});

describe("the zoom in words", () => {
  it.each([
    [0.75, "75%"],
    [0.8, "80%"],
    [1.25, "125%"],
  ])("%f_reads_%s", (zoom, words) => {
    const level = zoomLevelOf(zoom);

    expect(level).toBe(words);
  });
});

describe("the scroll that keeps the view's centre after a zoom", () => {
  it("scales_the_centre's_distance_from_the_start", () => {
    const scroll = centredScrollOf(100, 600, 1, 1.25);

    expect(scroll).toBe(200);
  });

  it("goes_back_when_zooming_out", () => {
    const scroll = centredScrollOf(200, 600, 1.25, 1);

    expect(scroll).toBe(100);
  });
});
