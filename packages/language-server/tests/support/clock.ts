import { onTestFinished, vi } from "vitest";

export function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
