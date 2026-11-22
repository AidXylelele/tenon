import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl, isDevelopment, isSessionCookieSecure } from "./environment";

vi.mock("server-only", () => ({}));

describe("the environment the console reads", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("the_api_is_where_API_URL_says", () => {
    vi.stubEnv("API_URL", "http://api.test");

    const url = apiUrl();

    expect(url).toBe("http://api.test");
  });

  it("without_API_URL_the_console_cannot_reach_the_api", () => {
    vi.stubEnv("API_URL", undefined);

    expect(apiUrl).toThrow(
      "API_URL is not set: the console cannot reach the API",
    );
  });

  it.each([
    ["true", true],
    ["false", false],
    ["", true],
  ])(
    "the_session_cookie_is_secure_unless_SESSION_COOKIE_SECURE_is_false: %j is %s",
    (value, secure) => {
      vi.stubEnv("SESSION_COOKIE_SECURE", value);

      const isSecure = isSessionCookieSecure();

      expect(isSecure).toBe(secure);
    },
  );

  it.each([
    ["development", true],
    ["production", false],
    ["test", false],
  ])("development_is_what_NODE_ENV_says: %s is %s", (mode, development) => {
    vi.stubEnv("NODE_ENV", mode);

    const isInDevelopment = isDevelopment();

    expect(isInDevelopment).toBe(development);
  });
});
