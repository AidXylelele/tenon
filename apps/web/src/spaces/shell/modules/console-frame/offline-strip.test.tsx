import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStrip } from "./offline-strip";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const LOST =
  "Can't reach Tenon. Your changes are kept and sent when it is back.";

function goOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  const kind = online ? "online" : "offline";
  const event = new Event(kind);
  act(() => {
    window.dispatchEvent(event);
  });
}

describe("the strip that says Tenon cannot be reached", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    router.refresh.mockClear();
  });

  it("says_nothing_while_tenon_answers", () => {
    render(<OfflineStrip reachable />);

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
  });

  it("speaks_when_the_platform_did_not_answer_the_page", () => {
    render(<OfflineStrip reachable={false} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(LOST);
  });

  it("speaks_when_the_browser_goes_offline", () => {
    render(<OfflineStrip reachable />);

    goOnline(false);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(LOST);
  });

  it("goes_quiet_when_the_browser_is_back_online", () => {
    render(<OfflineStrip reachable />);
    goOnline(false);

    goOnline(true);

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
  });

  it("asks_tenon_again_when_the_browser_is_back_online", () => {
    render(<OfflineStrip reachable={false} />);

    goOnline(true);

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("asks_tenon_again_every_half_minute_while_it_does_not_answer", () => {
    vi.useFakeTimers();
    render(<OfflineStrip reachable={false} />);

    vi.advanceTimersByTime(60_000);

    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("asks_nothing_while_tenon_answers", () => {
    vi.useFakeTimers();
    render(<OfflineStrip reachable />);

    vi.advanceTimersByTime(60_000);
    goOnline(true);

    expect(router.refresh).not.toHaveBeenCalled();
  });
});
