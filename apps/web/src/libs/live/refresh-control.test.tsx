import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshControl } from "./refresh-control";
import { chooseRefresh } from "./refresh-preference";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("the refresh control", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    act(() => {
      chooseRefresh("auto");
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes_a_second_after_opening_then_every_five_while_something_is_in_flight", async () => {
    render(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    const first = refresh.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(first).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Updated \d+ s ago/)).toBeInTheDocument();
  });

  it("refreshes_a_list_every_minute_when_nothing_is_in_flight", async () => {
    render(<RefreshControl activity="open" renderedAt={Date.now()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    const early = refresh.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(early).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("an_ended_page_refreshes_only_when_asked", async () => {
    render(<RefreshControl activity="ended" renderedAt={Date.now()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });
    const automatic = refresh.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));

    expect(automatic).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("follows_the_interval_the_viewer_chose_and_off_stops_it", async () => {
    act(() => {
      chooseRefresh("30000");
    });
    const { rerender } = render(
      <RefreshControl activity="in-flight" renderedAt={Date.now()} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    const before = refresh.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    const after = refresh.mock.calls.length;
    act(() => {
      chooseRefresh("off");
    });
    rerender(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });

    expect(before).toBe(0);
    expect(after).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("waits_while_the_page_is_hidden_and_refreshes_on_return_when_due", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    render(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    const hidden = refresh.mock.calls.length;
    const paused = screen.getByText("Paused while hidden");
    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(hidden).toBe(0);
    expect(paused).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });
});
