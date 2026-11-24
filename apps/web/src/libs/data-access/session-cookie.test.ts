import { describe, expect, it } from "vitest";
import { issuedSession, sessionCookieName } from "./session-cookie";

describe("the session the API issues", () => {
  it("is_kept_as_its_name_and_token_with_its_lifetime", () => {
    const issued = issuedSession([
      "sid=abc.def; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
    ]);

    expect(issued).toEqual({ pair: "sid=abc.def", maxAge: 2592000 });
  });

  it("a_cleared_cookie_ends_the_session", () => {
    const issued = issuedSession(["sid=; Max-Age=0; Path=/"]);

    expect(issued?.maxAge).toBe(0);
  });

  it("a_max_age_that_is_not_a_number_ends_the_session", () => {
    const issued = issuedSession(["sid=abc; Max-Age=soon; Path=/"]);

    expect(issued).toEqual({ pair: "sid=abc", maxAge: 0 });
  });

  it.each([
    ["another cookie", ["other=1; Path=/"]],
    ["no cookie", []],
  ])("a_response_without_a_session_cookie_issues_none: %s", (_, setCookies) => {
    const issued = issuedSession(setCookies);

    expect(issued).toBeNull();
  });

  it.each([
    [true, "__Host-console_session"],
    [false, "console_session"],
  ])(
    "the_cookie_is_pinned_to_the_origin_only_under_https: secure %s is %s",
    (secure, cookie) => {
      const name = sessionCookieName(secure);

      expect(name).toBe(cookie);
    },
  );
});
