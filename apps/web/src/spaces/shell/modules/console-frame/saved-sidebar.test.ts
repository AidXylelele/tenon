import { beforeEach, describe, expect, it, vi } from "vitest";
import { lastViewport, savedSidebarChoice } from "./saved-sidebar";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

describe("what the browser told the server about the sidebar", () => {
  beforeEach(() => {
    jar.clear();
  });

  it.each([
    ["true", true],
    ["false", false],
    ["maybe", null],
  ])("a_saved_choice_of_%s_reads_as_%s", async (value, choice) => {
    jar.set("sidebar_state", value);

    const saved = await savedSidebarChoice();

    expect(saved).toBe(choice);
  });

  it.each([
    ["narrow", "narrow"],
    ["wide", "wide"],
    ["huge", null],
  ])("a_last_viewport_of_%s_reads_as_%s", async (value, viewport) => {
    jar.set("viewport", value);

    const last = await lastViewport();

    expect(last).toBe(viewport);
  });

  it("a_first_visit_has_neither", async () => {
    const saved = await savedSidebarChoice();
    const last = await lastViewport();

    expect(saved).toBeNull();
    expect(last).toBeNull();
  });
});
