import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { ConsoleToaster } from "./console-toaster";

describe("the region where confirmations appear", () => {
  it("is_announced_politely_before_any_toast_comes", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(<ConsoleToaster />);

    const region = screen.getByRole("region", { name: /^Messages/ });
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});
