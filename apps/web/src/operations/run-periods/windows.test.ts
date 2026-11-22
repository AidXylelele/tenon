import { describe, expect, it } from "vitest";
import type { Period } from "./interfaces";
import { windowsOf } from "./windows";

const KYIV = "Europe/Kyiv";
const NEW_YORK = "America/New_York";

function labelsOf(period: Period, now: string, zone: string): string[] {
  const windows = windowsOf(period, now, zone);
  return windows.buckets.map((bucket) => bucket.label);
}

function bucketOf(period: Period, now: string, zone: string, label: string) {
  const windows = windowsOf(period, now, zone);
  return windows.buckets.find((bucket) => bucket.label === label);
}

describe("the window of a period, from the start of its first bucket to now", () => {
  it.each<[Period, string, string, string]>([
    ["24h", "2026-11-16T15:20:00.000Z", KYIV, "2026-11-15T16:00:00.000Z"],
    ["7d", "2026-11-16T15:20:00.000Z", KYIV, "2026-11-09T22:00:00.000Z"],
    ["30d", "2026-11-02T15:00:00.000Z", NEW_YORK, "2026-10-04T04:00:00.000Z"],
  ])("the_%s_up_to_%s_in_%s_start_at_%s", (period, now, zone, from) => {
    const windows = windowsOf(period, now, zone);

    expect(windows.current).toEqual({ from, to: now });
  });

  it("the_previous_window_is_as_long_and_ends_where_the_current_one_starts", () => {
    const windows = windowsOf("7d", "2026-11-16T15:20:00.000Z", KYIV);

    expect(windows.previous).toEqual({
      from: "2026-11-03T04:40:00.000Z",
      to: "2026-11-09T22:00:00.000Z",
    });
  });

  it.each<[Period, string]>([
    ["24h", "hour"],
    ["7d", "day"],
    ["30d", "day"],
  ])("the_%s_are_counted_per_%s", (period, unit) => {
    const windows = windowsOf(period, "2026-11-16T15:20:00.000Z", KYIV);

    expect(windows.unit).toBe(unit);
  });
});

describe("the hours of 24 hours, in the viewer's time zone", () => {
  it("are_the_current_hour_and_the_23_before_it", () => {
    const labels = labelsOf("24h", "2026-11-16T15:20:00.000Z", KYIV);

    expect(labels).toEqual([
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
      "02:00",
      "03:00",
      "04:00",
      "05:00",
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ]);
  });

  it("the_last_hour_ends_now_and_the_first_lasts_a_full_hour", () => {
    const windows = windowsOf("24h", "2026-11-16T15:20:00.000Z", KYIV);
    const first = windows.buckets.at(0);
    const last = windows.buckets.at(-1);

    expect({ first, last }).toEqual({
      first: {
        from: "2026-11-15T16:00:00.000Z",
        to: "2026-11-15T17:00:00.000Z",
        label: "18:00",
      },
      last: {
        from: "2026-11-16T15:00:00.000Z",
        to: "2026-11-16T15:20:00.000Z",
        label: "17:00",
      },
    });
  });

  it("skip_03:00_in_kyiv_when_clocks_go_forward_on_the_last_sunday_of_march", () => {
    const labels = labelsOf("24h", "2026-03-29T12:00:00.000Z", KYIV);

    expect(labels).toEqual([
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
      "02:00",
      "04:00",
      "05:00",
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ]);
  });

  it("read_01:00_twice_in_new_york_when_clocks_go_back_on_the_first_sunday_of_november", () => {
    const labels = labelsOf("24h", "2026-11-01T17:00:00.000Z", NEW_YORK);

    expect(labels).toEqual([
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
      "01:00",
      "02:00",
      "03:00",
      "04:00",
      "05:00",
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
    ]);
  });
});

describe("the days of 7 and 30 days, in the viewer's time zone", () => {
  it("7_days_are_today_and_the_6_before_it_by_weekday", () => {
    const labels = labelsOf("7d", "2026-11-16T15:20:00.000Z", KYIV);

    expect(labels).toEqual([
      "Tue 10",
      "Wed 11",
      "Thu 12",
      "Fri 13",
      "Sat 14",
      "Sun 15",
      "Mon 16",
    ]);
  });

  it("30_days_cross_the_end_of_a_month_by_date", () => {
    const labels = labelsOf("30d", "2026-11-02T15:00:00.000Z", NEW_YORK);

    expect(labels).toEqual([
      "4 Oct",
      "5 Oct",
      "6 Oct",
      "7 Oct",
      "8 Oct",
      "9 Oct",
      "10 Oct",
      "11 Oct",
      "12 Oct",
      "13 Oct",
      "14 Oct",
      "15 Oct",
      "16 Oct",
      "17 Oct",
      "18 Oct",
      "19 Oct",
      "20 Oct",
      "21 Oct",
      "22 Oct",
      "23 Oct",
      "24 Oct",
      "25 Oct",
      "26 Oct",
      "27 Oct",
      "28 Oct",
      "29 Oct",
      "30 Oct",
      "31 Oct",
      "1 Nov",
      "2 Nov",
    ]);
  });

  it("today_ends_now", () => {
    const today = bucketOf("7d", "2026-11-16T15:20:00.000Z", KYIV, "Mon 16");

    expect(today).toEqual({
      from: "2026-11-15T22:00:00.000Z",
      to: "2026-11-16T15:20:00.000Z",
      label: "Mon 16",
    });
  });

  it.each([
    [
      "the_last_sunday_of_march_in_kyiv_lasts_23_hours",
      "7d",
      "2026-03-31T09:00:00.000Z",
      KYIV,
      "Sun 29",
      "2026-03-28T22:00:00.000Z",
      "2026-03-29T21:00:00.000Z",
    ],
    [
      "the_last_sunday_of_october_in_kyiv_lasts_25_hours",
      "30d",
      "2026-11-05T10:00:00.000Z",
      KYIV,
      "25 Oct",
      "2026-10-24T21:00:00.000Z",
      "2026-10-25T22:00:00.000Z",
    ],
    [
      "the_second_sunday_of_march_in_new_york_lasts_23_hours",
      "7d",
      "2026-03-10T16:00:00.000Z",
      NEW_YORK,
      "Sun 8",
      "2026-03-08T05:00:00.000Z",
      "2026-03-09T04:00:00.000Z",
    ],
    [
      "the_first_sunday_of_november_in_new_york_lasts_25_hours",
      "30d",
      "2026-11-02T15:00:00.000Z",
      NEW_YORK,
      "1 Nov",
      "2026-11-01T04:00:00.000Z",
      "2026-11-02T05:00:00.000Z",
    ],
    [
      "a_day_whose_midnight_is_skipped_starts_when_clocks_jump",
      "7d",
      "2026-09-08T12:00:00.000Z",
      "America/Santiago",
      "Sun 6",
      "2026-09-06T04:00:00.000Z",
      "2026-09-07T03:00:00.000Z",
    ],
    [
      "a_day_whose_midnight_comes_twice_starts_at_the_first",
      "7d",
      "2026-11-03T12:00:00.000Z",
      "America/Havana",
      "Sun 1",
      "2026-11-01T04:00:00.000Z",
      "2026-11-02T05:00:00.000Z",
    ],
  ] as const)("%s", (_, period, now, zone, label, from, to) => {
    const day = bucketOf(period, now, zone, label);

    expect(day).toEqual({ from, to, label });
  });
});
