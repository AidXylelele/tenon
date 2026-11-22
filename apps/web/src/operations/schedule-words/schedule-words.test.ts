import { describe, expect, it } from "vitest";
import type { Trigger } from "language-server/protocol";
import { scheduleText, triggerText } from "./schedule-words";

describe("how a workflow starts on its own, in words", () => {
  it.each([
    [{ kind: "every", interval: 900_000 }, "Every 15 minutes"],
    [{ kind: "every", interval: 3_600_000 }, "Every 1 hour"],
    [{ kind: "cron", cron: "0 2 * * *" }, "On the schedule 0 2 * * * (UTC)"],
    [
      { kind: "after", delay: 30_000 },
      "30 seconds after the previous run ends",
    ],
    [
      { kind: "on", stream: "com.acme.order.paid" },
      "When an event on com.acme.order.paid arrives",
    ],
  ] as const)("%o_reads_%s", (schedule, text) => {
    expect(scheduleText(schedule)).toBe(text);
  });

  it.each([
    ["every", "PT1M", 60_000, "Every 1 minute"],
    ["after", "{ minutes: 1 }", 60_000, "1 minute after the previous run ends"],
    ["every", "${ .interval }", null, "Every ${ .interval }"],
  ] as const)(
    "a_%s_of_%s_reads_in_words",
    (kind, summary, milliseconds, text) => {
      const pointer = `/schedule/${kind}`;
      const trigger: Trigger = { kind, pointer, summary, milliseconds };

      expect(triggerText(trigger)).toBe(text);
    },
  );
});
