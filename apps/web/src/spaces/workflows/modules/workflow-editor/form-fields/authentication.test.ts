import { describe, expect, it } from "vitest";
import { authenticationEditsOf, authenticationOf } from "./authentication";

const AT = "/do/0/fetch/with/endpoint/authentication";

const UNWRITTEN = { pointer: AT, required: false, written: false, value: null };

const BEARER = {
  pointer: AT,
  required: false,
  written: true,
  value: { bearer: { use: "API_TOKEN" } },
};

describe("how a call signs in", () => {
  it.each([
    [
      "nothing_written_signs_in_with_nothing",
      null,
      { scheme: "none", secret: "" },
    ],
    [
      "a_bearer_token_names_its_secret",
      BEARER.value,
      { scheme: "bearer", secret: "API_TOKEN" },
    ],
    [
      "basic_names_its_secret",
      { basic: { use: "SIGN_IN" } },
      { scheme: "basic", secret: "SIGN_IN" },
    ],
    [
      "another_policy_is_left_as_written",
      { oauth2: { authority: "x" } },
      { scheme: "other", secret: "" },
    ],
  ])("%s", (_, value, expected) => {
    const read = authenticationOf(value);

    expect(read).toEqual(expected);
  });

  it("a_scheme_with_its_secret_is_written_whole", () => {
    const chosen = { scheme: "basic", secret: " SIGN_IN " } as const;

    const edits = authenticationEditsOf(UNWRITTEN, chosen);

    expect(edits).toEqual([
      { kind: "setField", pointer: AT, value: { basic: { use: "SIGN_IN" } } },
    ]);
  });

  it("a_scheme_without_a_secret_waits_for_one", () => {
    const chosen = { scheme: "bearer", secret: "" } as const;

    const edits = authenticationEditsOf(UNWRITTEN, chosen);

    expect(edits).toEqual([]);
  });

  it("none_removes_the_authentication", () => {
    const chosen = { scheme: "none", secret: "" } as const;

    const edits = authenticationEditsOf(BEARER, chosen);

    expect(edits).toEqual([{ kind: "clearField", pointer: AT }]);
  });
});
