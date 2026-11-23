import { beforeEach, describe, expect, it, vi } from "vitest";
import { inProgressNow } from "./in-progress";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

const COUNTS = {
  counts: {
    pending: 1,
    running: 4,
    waiting: 2,
    suspended: 3,
    completed: 90,
    faulted: 7,
    cancelled: 1,
  },
};

describe("the runs in progress now", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
  });

  it("are_the_queued_running_waiting_and_paused_ones_of_any_age", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json(COUNTS)));

    const count = await inProgressNow();

    expect(count).toBe(10);
  });

  it("are_none_shown_while_the_platform_does_not_answer", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("refused")));

    const count = await inProgressNow();

    expect(count).toBe(0);
  });
});
