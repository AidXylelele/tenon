import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerZone } from "./viewer-zone";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const OWN = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("telling the console the viewer's time zone", () => {
  afterEach(() => {
    refresh.mockReset();
    document.cookie = "console_zone=; max-age=0; path=/";
  });

  it("a_page_read_in_another_zone_keeps_the_viewers_and_reads_again", () => {
    render(<ViewerZone zone="Pacific/Chatham" />);

    const kept = encodeURIComponent(OWN);
    expect(document.cookie).toContain(`console_zone=${kept}`);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("a_page_read_in_the_viewers_zone_changes_nothing", () => {
    render(<ViewerZone zone={OWN} />);

    expect(document.cookie).not.toContain("console_zone");
    expect(refresh).not.toHaveBeenCalled();
  });
});
