import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class SilentResizeObserver {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}

globalThis.ResizeObserver = SilentResizeObserver;

afterEach(() => {
  cleanup();
});
