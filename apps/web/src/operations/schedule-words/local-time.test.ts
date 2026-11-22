import { describe, expect, it } from "vitest";
import { daylightNote, localTimeText, startText } from "./local-time";

const KYIV = "Europe/Kyiv";
const NEW_YORK = "America/New_York";

const SHIFT =
  "local time shifts with daylight saving, the schedule stays in UTC.";

describe("a UTC schedule in the viewer's time today", () => {
  it.each([
    ["0 9 * * *", "2026-11-22T12:00:00.000Z", KYIV, "11:00 your time"],
    ["0 9 * * *", "2026-07-01T12:00:00.000Z", KYIV, "12:00 your time"],
    ["0 9 * * *", "2026-11-22T12:00:00.000Z", NEW_YORK, "04:00 your time"],
    ["0 9 * * *", "2026-11-22T12:00:00.000Z", "UTC", "09:00 your time"],
    ["30 23 * * *", "2026-11-22T12:00:00.000Z", KYIV, "01:30 your time"],
    [
      "30 23 * * 1",
      "2026-11-22T12:00:00.000Z",
      KYIV,
      "01:30 your time, the next day",
    ],
    [
      "0 2 * * 1-5",
      "2026-11-22T12:00:00.000Z",
      NEW_YORK,
      "21:00 your time, the day before",
    ],
  ])("%s_on_%s_in_%s_is_%s", (cron, now, zone, text) => {
    const local = localTimeText(cron, now, zone);

    expect(local).toBe(text);
  });

  it.each(["*/10 * * * *", "0 * * * *", "0 2 1 * *"])(
    "%s_has_no_one_time_of_day",
    (cron) => {
      const local = localTimeText(cron, "2026-11-22T12:00:00.000Z", KYIV);

      expect(local).toBeNull();
    },
  );
});

describe("the note when daylight saving shifts the local time within a week", () => {
  it.each([
    [
      "the_last_sunday_of_march_in_kyiv",
      "0 9 * * *",
      "2026-03-25T12:00:00.000Z",
      KYIV,
      `From Sun 29 Mar it starts at 12:00 your time: ${SHIFT}`,
    ],
    [
      "the_last_sunday_of_october_in_kyiv",
      "0 9 * * *",
      "2026-10-21T12:00:00.000Z",
      KYIV,
      `From Sun 25 Oct it starts at 11:00 your time: ${SHIFT}`,
    ],
    [
      "the_second_sunday_of_march_in_new_york",
      "0 14 * * *",
      "2026-03-05T12:00:00.000Z",
      NEW_YORK,
      `From Sun 8 Mar it starts at 10:00 your time: ${SHIFT}`,
    ],
    [
      "the_first_sunday_of_november_in_new_york",
      "0 14 * * *",
      "2026-10-28T12:00:00.000Z",
      NEW_YORK,
      `From Sun 1 Nov it starts at 09:00 your time: ${SHIFT}`,
    ],
    [
      "a_weekly_start_after_the_change",
      "0 9 * * 1",
      "2026-03-26T12:00:00.000Z",
      KYIV,
      `From Mon 30 Mar it starts at 12:00 your time: ${SHIFT}`,
    ],
    [
      "a_late_start_that_lands_on_the_next_local_day",
      "30 23 * * *",
      "2026-03-25T12:00:00.000Z",
      KYIV,
      `From Mon 30 Mar it starts at 02:30 your time: ${SHIFT}`,
    ],
  ])("%s", (_, cron, now, zone, note) => {
    const shift = daylightNote(cron, now, zone);

    expect(shift).toBe(note);
  });

  it.each([
    [
      "a_change_more_than_a_week_away",
      "0 9 * * *",
      "2026-03-20T12:00:00.000Z",
      KYIV,
    ],
    ["no_change_ahead", "0 9 * * *", "2026-11-22T12:00:00.000Z", KYIV],
    [
      "a_zone_without_daylight_saving",
      "0 9 * * *",
      "2026-03-25T12:00:00.000Z",
      "UTC",
    ],
    [
      "a_schedule_without_one_time_of_day",
      "*/10 * * * *",
      "2026-03-25T12:00:00.000Z",
      KYIV,
    ],
    ["a_cron_that_does_not_parse", "0 9 * *", "2026-03-25T12:00:00.000Z", KYIV],
  ])("no_note_for_%s", (_, cron, now, zone) => {
    const shift = daylightNote(cron, now, zone);

    expect(shift).toBeNull();
  });
});

describe("a start, in UTC and in the viewer's time", () => {
  it.each([
    [
      "2026-11-23T09:00:00.000Z",
      KYIV,
      "Mon 23 Nov 09:00 UTC · 11:00 your time",
    ],
    [
      "2026-11-23T23:30:00.000Z",
      KYIV,
      "Mon 23 Nov 23:30 UTC · Tue 24 Nov 01:30 your time",
    ],
    [
      "2026-11-23T02:00:00.000Z",
      NEW_YORK,
      "Mon 23 Nov 02:00 UTC · Sun 22 Nov 21:00 your time",
    ],
  ])("%s_in_%s_reads_%s", (start, zone, text) => {
    const words = startText(start, zone);

    expect(words).toBe(text);
  });
});
