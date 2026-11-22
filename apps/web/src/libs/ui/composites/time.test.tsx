import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown, Duration, Time } from "./time";

const AT = "2026-11-03T12:00:00.000Z";

describe("times on a page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("the_server_renders_a_time_that_needs_no_locale", () => {
    const html = renderToString(<Time value={AT} />);

    expect(html).toContain("2026-11-03 12:00 UTC");
  });

  it("the_browser_says_how_long_ago_and_keeps_it_true", async () => {
    const started = new Date(Date.now() - 180_000).toISOString();
    render(<Time value={started} />);
    const first = screen.getByRole("time").textContent;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(first).toBe("3 minutes ago");
    expect(screen.getByRole("time")).toHaveTextContent("5 minutes ago");
    expect(screen.getByRole("time")).toHaveAttribute("dateTime", started);
  });

  it("a_missing_time_shows_its_placeholder", () => {
    render(<Time value={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("a_finished_duration_is_how_long_it_took", () => {
    render(<Duration from={AT} to="2026-11-03T12:03:05.000Z" />);

    expect(screen.getByText("3 min 5 s")).toBeInTheDocument();
  });

  it("a_running_duration_counts_every_second", async () => {
    const started = new Date().toISOString();
    render(<Duration from={started} to={null} />);
    const before = screen.getByText("…");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(before).toBeInTheDocument();
    expect(screen.getByText("4.0 s")).toBeInTheDocument();
  });

  it("a_duration_that_never_started_shows_a_dash", () => {
    render(<Duration from={null} to={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("a_countdown_counts_to_now", async () => {
    const due = new Date(Date.now() + 3_000).toISOString();
    render(<Countdown to={due} />);
    const before = screen.getByText("…").textContent;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const started = screen.getByText(/^in/).textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(before).toBe("…");
    expect(started).toBe("in 3 s");
    expect(screen.getByText("now")).toBeInTheDocument();
  });

  it("a_countdown_past_a_minute_says_minutes_and_seconds", async () => {
    const due = new Date(Date.now() + 185_000).toISOString();
    render(<Countdown to={due} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByText("in 3 min 5 s")).toBeInTheDocument();
  });
});
