import { describe, expect, it } from "vitest";
import type { PhaseCounts } from "@/libs/data-access/types";
import {
  countWindowOf,
  figuresOf,
  inProgressOf,
  liveWindowOf,
  seriesOf,
} from "./figures";
import { windowsOf } from "./windows";

const NONE: PhaseCounts = {
  pending: 0,
  running: 0,
  waiting: 0,
  suspended: 0,
  completed: 0,
  faulted: 0,
  cancelled: 0,
};

const NOW = { pending: 1, running: 2, waiting: 3, suspended: 4 };

describe("runs counted by period", () => {
  it("asks_for_the_counts_from_the_starts_of_the_periods_buckets_with_the_previous_period", () => {
    const windows = windowsOf("7d", "2026-11-23T10:30:00.000Z", "UTC");

    const window = countWindowOf(windows);

    expect(window.buckets).toHaveLength(7);
    expect(window.buckets[0]).toBe("2026-11-17T00:00:00.000Z");
    expect(window.to).toBe("2026-11-23T10:30:00.000Z");
    expect(window.previousFrom).toBe(windows.previous.from);
  });

  it("figures_count_the_started_succeeded_failed_and_cancelled_runs_against_the_previous_period", () => {
    const total = { ...NONE, running: 1, completed: 6, faulted: 2 };
    const previous = { ...NONE, completed: 3, cancelled: 1 };

    const figures = figuresOf(total, previous);

    expect(figures).toEqual([
      { kind: "started", count: 9, previous: 4 },
      { kind: "succeeded", count: 6, previous: 3 },
      { kind: "failed", count: 2, previous: 0 },
      { kind: "cancelled", count: 0, previous: 1 },
    ]);
  });

  it("figures_without_a_previous_period_have_nothing_to_compare", () => {
    const figures = figuresOf(NONE, null);

    const previous = figures.map((figure) => figure.previous);
    expect(previous).toEqual([null, null, null, null]);
  });

  it("the_live_count_asks_for_the_minute_up_to_now", () => {
    const window = liveWindowOf("2026-11-23T10:00:00.000Z");

    expect(window).toEqual({
      buckets: ["2026-11-23T09:59:00.000Z"],
      to: "2026-11-23T10:00:00.000Z",
    });
  });

  it("in_progress_now_is_every_run_still_going_whenever_it_started", () => {
    const inProgress = inProgressOf(NOW);

    expect(inProgress).toBe(10);
  });

  it("the_series_puts_each_buckets_counts_under_its_label_with_in_progress_summed", () => {
    const windows = windowsOf("24h", "2026-11-23T10:30:00.000Z", "UTC");
    const counted = windows.buckets.map((bucket, index) => {
      const counts = { ...NONE, completed: index, running: 1, waiting: 1 };
      return { start: bucket.from, counts };
    });

    const series = seriesOf(windows.buckets, counted);

    expect(series).toHaveLength(24);
    expect(series[23]).toEqual({
      label: "10:00",
      from: "2026-11-23T10:00:00.000Z",
      to: "2026-11-23T10:30:00.000Z",
      succeeded: 23,
      failed: 0,
      cancelled: 0,
      inProgress: 2,
    });
  });

  it("a_bucket_the_platform_did_not_count_is_empty", () => {
    const windows = windowsOf("7d", "2026-11-23T10:30:00.000Z", "UTC");

    const series = seriesOf(windows.buckets, []);

    const started = series.map(
      (bar) => bar.succeeded + bar.failed + bar.cancelled + bar.inProgress,
    );
    expect(started).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
