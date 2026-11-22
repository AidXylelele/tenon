import { describe, expect, it } from "vitest";
import { nextStartsOf } from "./cron-table";

describe("the next starts of a cron schedule, in UTC", () => {
  it.each([
    [
      "every_day_starts_on_the_next_days",
      "0 9 * * *",
      "2026-11-22T10:00:00.000Z",
      3,
      [
        "2026-11-23T09:00:00.000Z",
        "2026-11-24T09:00:00.000Z",
        "2026-11-25T09:00:00.000Z",
      ],
    ],
    [
      "a_start_later_today_comes_first",
      "0 9 * * *",
      "2026-11-22T08:59:30.000Z",
      1,
      ["2026-11-22T09:00:00.000Z"],
    ],
    [
      "a_start_at_this_very_moment_is_not_a_next_one",
      "0 9 * * *",
      "2026-11-22T09:00:00.000Z",
      1,
      ["2026-11-23T09:00:00.000Z"],
    ],
    [
      "every_10_minutes_starts_on_the_tens",
      "*/10 * * * *",
      "2026-11-22T10:03:00.000Z",
      3,
      [
        "2026-11-22T10:10:00.000Z",
        "2026-11-22T10:20:00.000Z",
        "2026-11-22T10:30:00.000Z",
      ],
    ],
    [
      "a_step_from_a_value_runs_to_the_end_of_the_hour",
      "15/20 * * * *",
      "2026-11-22T10:00:00.000Z",
      3,
      [
        "2026-11-22T10:15:00.000Z",
        "2026-11-22T10:35:00.000Z",
        "2026-11-22T10:55:00.000Z",
      ],
    ],
    [
      "weekdays_skip_the_weekend",
      "0 9 * * 1-5",
      "2026-11-20T10:00:00.000Z",
      3,
      [
        "2026-11-23T09:00:00.000Z",
        "2026-11-24T09:00:00.000Z",
        "2026-11-25T09:00:00.000Z",
      ],
    ],
    [
      "a_day_of_the_month_and_a_weekday_run_on_either",
      "0 0 1 * 1",
      "2026-11-22T10:00:00.000Z",
      3,
      [
        "2026-11-23T00:00:00.000Z",
        "2026-11-30T00:00:00.000Z",
        "2026-12-01T00:00:00.000Z",
      ],
    ],
    [
      "a_stepped_day_of_the_month_with_a_weekday_runs_on_both",
      "0 0 */2 * 1",
      "2026-11-22T10:00:00.000Z",
      3,
      [
        "2026-11-23T00:00:00.000Z",
        "2026-12-07T00:00:00.000Z",
        "2026-12-21T00:00:00.000Z",
      ],
    ],
    [
      "named_months_and_stepped_ranges_wait_for_the_new_year",
      "5-10/5 4 * jan-mar *",
      "2026-11-22T10:00:00.000Z",
      3,
      [
        "2027-01-01T04:05:00.000Z",
        "2027-01-01T04:10:00.000Z",
        "2027-01-02T04:05:00.000Z",
      ],
    ],
    [
      "the_29th_of_february_waits_for_a_leap_year",
      "0 0 29 2 *",
      "2026-11-22T10:00:00.000Z",
      1,
      ["2028-02-29T00:00:00.000Z"],
    ],
    [
      "the_30th_of_february_never_comes",
      "0 0 30 2 *",
      "2026-11-22T10:00:00.000Z",
      3,
      [],
    ],
    [
      "a_cron_that_does_not_parse_never_starts",
      "0 9 32 * 1",
      "2026-11-22T10:00:00.000Z",
      3,
      [],
    ],
  ])("%s", (_, cron, now, count, starts) => {
    const next = nextStartsOf(cron, now, count);

    expect(next).toEqual(starts);
  });
});
