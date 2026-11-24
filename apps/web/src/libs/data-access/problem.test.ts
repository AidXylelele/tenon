import { describe, expect, it } from "vitest";
import { codeOf, problemOf } from "./problem";

const INVALID_DEFINITION = {
  type: "urn:problem:definition.invalid",
  title: "The workflow definition is invalid",
  status: 422,
  detail: "must have required property endpoint",
  errors: [
    {
      code: "schema",
      pointer: "/do/0/fetch/with",
      detail: "must have required property endpoint",
      line: 12,
      column: 7,
    },
  ],
};

const THROTTLED = {
  type: "about:blank",
  title: "Too Many Requests",
  status: 429,
  detail: "ThrottlerException: Too Many Requests",
};

describe("a refusal of the API", () => {
  it("reads_the_platform_code_of_an_rfc_9457_problem", () => {
    const problem = problemOf(422, INVALID_DEFINITION, null);

    const code = codeOf(problem);

    expect(code).toBe("definition.invalid");
  });

  it("reads_the_locations_of_an_rfc_9457_problem", () => {
    const problem = problemOf(422, INVALID_DEFINITION, null);

    expect(problem.errors).toEqual([
      {
        pointer: "/do/0/fetch/with",
        detail: "must have required property endpoint",
        line: 12,
        column: 7,
      },
    ]);
  });

  it.each([
    ["900", "try again in 15 minutes"],
    ["60", "try again in 1 minute"],
    ["30", "try again in 30 seconds"],
    ["0", "wait a while and try again"],
    [null, "wait a while and try again"],
  ])("a_throttled_request_says_how_long_to_wait_%s", (retryAfter, wait) => {
    const problem = problemOf(429, THROTTLED, retryAfter);

    expect(problem.detail).toBe(`Too many tries in a short time; ${wait}`);
  });

  it("a_busy_platform_keeps_its_detail_and_says_when_to_retry", () => {
    const busy = {
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The analysis pool is full.",
      code: "BULKHEAD_FULL",
    };

    const problem = problemOf(503, busy, "20");

    expect(problem).toMatchObject({
      detail: "The analysis pool is full.",
      retryAfter: 20,
    });
  });

  it("a_body_that_is_not_json_still_becomes_a_problem", () => {
    const problem = problemOf(502, "Bad gateway", null);

    expect(problem).toMatchObject({
      status: 502,
      title: "HTTP 502",
      detail: "HTTP 502",
    });
  });

  it.each([
    [
      "a pointer",
      { pointer: "/do/0" },
      { pointer: "/do/0", detail: "", line: null, column: null },
    ],
    [
      "a detail",
      { detail: "is invalid" },
      { pointer: "", detail: "is invalid", line: null, column: null },
    ],
  ])("a_location_with_only_%s_keeps_it", (_, location, kept) => {
    const problem = problemOf(422, { errors: [location] }, null);

    expect(problem.errors).toEqual([kept]);
  });

  it("a_location_with_neither_a_pointer_nor_a_detail_is_dropped", () => {
    const problem = problemOf(422, { errors: [{}] }, null);

    expect(problem.errors).toEqual([]);
  });
});
