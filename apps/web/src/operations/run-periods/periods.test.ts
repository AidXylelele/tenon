import { describe, expect, it } from "vitest";
import type { Period, Started } from "./interfaces";
import { changeText, periodLabel, periodPhrase, startedOf } from "./periods";

describe("the words of a period", () => {
  it.each<[Started, string, string]>([
    ["24h", "24 hours", "in the last 24 hours"],
    ["7d", "7 days", "in the last 7 days"],
    ["30d", "30 days", "in the last 30 days"],
    ["all", "Any time", "at any time"],
  ])("%s_is_named_%s_and_read_%s", (started, label, phrase) => {
    const named = periodLabel(started);
    const read = periodPhrase(started);

    expect({ named, read }).toEqual({ named: label, read: phrase });
  });

  it.each<[number, number, Period, string]>([
    [12, 8, "7d", "↑ from 8 the previous 7 days"],
    [3, 8, "24h", "↓ from 8 the previous 24 hours"],
    [8, 8, "30d", "same as 8 the previous 30 days"],
    [1500, 1234, "30d", "↑ from 1,234 the previous 30 days"],
  ])("%i_against_%i_over_%s_reads_%s", (current, previous, period, text) => {
    const change = changeText(current, previous, period);

    expect(change).toBe(text);
  });
});

describe("the period in the address", () => {
  it.each<[string | undefined, Started | null]>([
    ["24h", "24h"],
    ["7d", "7d"],
    ["30d", "30d"],
    ["all", "all"],
    ["1h", null],
    ["", null],
    [undefined, null],
  ])("started=%s_is_%s", (text, started) => {
    const parsed = startedOf(text);

    expect(parsed).toBe(started);
  });
});
