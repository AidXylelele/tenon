import { describe, expect, it } from "vitest";
import type { Repeat } from "./interfaces";
import {
  cronOf,
  cronText,
  REPEAT_CHOICES,
  repeatLabel,
  repeatOf,
} from "./repeats";

const NINE = { hour: 9, minute: 0 };

describe("a cron schedule, in UTC, in words", () => {
  it.each([
    ["0 9 * * *", "Every day at 09:00 UTC"],
    ["0 9 * * 0-6", "Every day at 09:00 UTC"],
    ["30 6 * * 1-5", "Every weekday at 06:30 UTC"],
    ["0 9 * * MON-FRI", "Every weekday at 09:00 UTC"],
    ["0 9 * * 1", "Every Monday at 09:00 UTC"],
    ["0 9 * * 1,4", "Every Monday and Thursday at 09:00 UTC"],
    ["0 9 * * mon,wed,fri", "Every Monday, Wednesday and Friday at 09:00 UTC"],
    ["0 9 * * 0,6", "Every Saturday and Sunday at 09:00 UTC"],
    ["0 9 * * 7", "Every Sunday at 09:00 UTC"],
    ["0 * * * *", "Every hour"],
    ["1 * * * *", "Every hour at 1 minute past"],
    ["15 * * * *", "Every hour at 15 minutes past"],
    ["*/10 * * * *", "Every 10 minutes"],
    ["0,30 * * * *", "Every 30 minutes"],
    ["* * * * *", "Every minute"],
    ["  0   9 * * *  ", "Every day at 09:00 UTC"],
  ])("%s_reads_%s", (cron, text) => {
    const words = cronText(cron);

    expect(words).toBe(text);
  });

  it("a_day_of_the_month_and_a_weekday_together_run_on_either", () => {
    const words = cronText("0 9 1-31 * 1");

    expect(words).toBe("Every day at 09:00 UTC");
  });

  it.each([
    "*/7 * * * *",
    "15,45 * * * *",
    "0 2 1 * *",
    "0 9-17 * * 1-5",
    "0 9 * 1-6 *",
    "0 * * * 1-5",
    "61 * * * *",
    "0 9 32 * 1",
    "0 9 * * 1/0",
    "0 9 * * 5-1",
    "0 9 * * 1-2-3",
    "0 9 * * 1/2/3",
    "0 9 * * tue-x",
    "0 9 * *",
    "0 0 9 * * *",
  ])("%s_is_shown_as_written", (cron) => {
    const words = cronText(cron);

    expect(words).toBe(`On the schedule ${cron} (UTC)`);
  });
});

describe("the schedule form's repeat choices", () => {
  it("are_the_six_of_the_form_in_its_order", () => {
    const labels = REPEAT_CHOICES.map(repeatLabel);

    expect(labels).toEqual([
      "Every day",
      "Every weekday",
      "Every hour",
      "Every 10 minutes",
      "Every week on…",
      "A custom schedule (cron)",
    ]);
  });

  it.each<[Repeat, string]>([
    [{ kind: "daily", at: { hour: 6, minute: 30 } }, "30 6 * * *"],
    [{ kind: "weekdays", at: NINE }, "0 9 * * 1-5"],
    [{ kind: "hourly", minute: 15 }, "15 * * * *"],
    [{ kind: "minutes", every: 10 }, "*/10 * * * *"],
    [{ kind: "minutes", every: 1 }, "* * * * *"],
    [{ kind: "weekly", days: [5, 0, 1], at: NINE }, "0 9 * * 0,1,5"],
    [{ kind: "custom", cron: "0 2 1 * *" }, "0 2 1 * *"],
  ])("%o_writes_%s", (repeat, cron) => {
    const written = cronOf(repeat);

    expect(written).toBe(cron);
  });

  it.each<[string, Repeat]>([
    ["0 9 * * *", { kind: "daily", at: NINE }],
    ["0 9 * * mon-fri", { kind: "weekdays", at: NINE }],
    ["45 * * * *", { kind: "hourly", minute: 45 }],
    ["*/15 * * * *", { kind: "minutes", every: 15 }],
    ["0 9 * * 1,5,0", { kind: "weekly", days: [0, 1, 5], at: NINE }],
    ["0 9 * * 1-5/2", { kind: "weekly", days: [1, 3, 5], at: NINE }],
    ["0 9 * * 5/1", { kind: "weekly", days: [0, 5, 6], at: NINE }],
    ["0 2 1 * *", { kind: "custom", cron: "0 2 1 * *" }],
  ])("%s_is_read_back_as_%o", (cron, repeat) => {
    const read = repeatOf(cron);

    expect(read).toEqual(repeat);
  });

  it.each(["30 6 * * *", "0 9 * * 1-5", "15 * * * *", "*/10 * * * *"])(
    "%s_written_by_the_form_reads_back_the_same",
    (cron) => {
      const repeat = repeatOf(cron);
      const written = cronOf(repeat);

      expect(written).toBe(cron);
    },
  );
});
