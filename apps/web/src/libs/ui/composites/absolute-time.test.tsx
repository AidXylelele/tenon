import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../components/tooltip";
import { AbsoluteTime, absoluteText } from "./absolute-time";

const NOW = new Date(2026, 10, 23, 16, 0).getTime();

describe("a time said as a date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [new Date(2026, 10, 23, 15, 20), "Today 15:20"],
    [new Date(2026, 10, 22, 9, 5), "Yesterday 09:05"],
    [new Date(2026, 10, 20, 9, 0), "20 Nov 09:00"],
    [new Date(2025, 0, 3, 7, 30), "3 Jan 2025 07:30"],
  ])("%s_reads_as_%s", (at, words) => {
    expect(absoluteText(at.getTime(), NOW)).toBe(words);
  });

  it("shows_the_date_and_keeps_the_exact_moment_for_machines", () => {
    const at = new Date(2026, 10, 23, 15, 20).toISOString();
    render(
      <TooltipProvider>
        <AbsoluteTime value={at} />
      </TooltipProvider>,
    );

    const time = screen.getByText("Today 15:20");
    expect(time).toHaveAttribute("datetime", at);
  });

  it("says_the_seconds_where_asked", () => {
    const at = new Date(2026, 10, 23, 15, 24, 31);

    const words = absoluteText(at.getTime(), NOW, true);

    expect(words).toBe("Today 15:24:31");
  });

  it("a_missing_time_is_a_dash", () => {
    render(<AbsoluteTime value={null} />);

    expect(screen.getByText("—")).toBeVisible();
  });
});
