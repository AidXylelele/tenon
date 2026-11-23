import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveUpdates } from "./live-updates";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  const name = offline ? "offline" : "online";
  window.dispatchEvent(new Event(name));
}

async function waitMs(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("a page that updates by itself", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reads_again_every_five_seconds_while_something_runs_and_says_nothing", async () => {
    render(<LiveUpdates activity="in-flight" />);

    await waitMs(10_100);

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads_again_every_minute_when_nothing_runs", async () => {
    render(<LiveUpdates activity="open" />);

    await waitMs(59_000);
    const early = refresh.mock.calls.length;
    await waitMs(2_000);

    expect(early).toBe(0);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("an_ended_run_is_not_read_again", async () => {
    render(<LiveUpdates activity="ended" />);

    await waitMs(120_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("a_lost_connection_pauses_and_offers_to_reconnect", async () => {
    render(<LiveUpdates activity="in-flight" />);

    act(() => {
      goOffline(true);
    });
    await waitMs(10_000);
    const paused = refresh.mock.calls.length;
    const reconnect = screen.getByRole("button", { name: "Reconnect" });
    fireEvent.click(reconnect);

    expect(paused).toBe(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Live updates paused");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
