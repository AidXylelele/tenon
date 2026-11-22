import { describe, expect, it, vi } from "vitest";
import { savedSidebarChoice } from "./saved-sidebar";

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "sidebar_state" && cookie.value !== undefined
          ? { name, value: cookie.value }
          : undefined,
    }),
}));

describe("the sidebar the person chose", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["maybe", null],
    [undefined, null],
  ])("a_cookie_of_%s_reads_as_%s", async (value, choice) => {
    cookie.value = value;

    const saved = await savedSidebarChoice();

    expect(saved).toBe(choice);
  });
});
