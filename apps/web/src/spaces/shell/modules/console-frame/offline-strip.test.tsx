import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStrip } from "./offline-strip";

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
});
