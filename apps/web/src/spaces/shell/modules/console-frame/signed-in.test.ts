import { beforeEach, describe, expect, it, vi } from "vitest";
import { signedIn } from "./signed-in";

const jar = vi.hoisted(() => ({ session: undefined as string | undefined }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () =>
        jar.session === undefined ? undefined : { value: jar.session },
    }),
  headers: () => Promise.resolve(new Headers()),
}));

const SESSION = {
  user: { id: "user-1", email: "ada@example.com", name: "Ada", role: "admin" },
  capabilities: { author: true, operator: true, administrator: true },
};

describe("the person signed in to the console", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    jar.session = "pair";
  });

  it("is_no_one_without_a_session", async () => {
    jar.session = undefined;

    const session = await signedIn();

    expect(session).toBeNull();
  });

  it("is_the_session_the_platform_answers", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json(SESSION)));

    const session = await signedIn();

    expect(session).toEqual(SESSION);
  });

  it("is_no_one_while_the_platform_does_not_answer", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("refused")));

    const session = await signedIn();

    expect(session).toBeNull();
  });
});
