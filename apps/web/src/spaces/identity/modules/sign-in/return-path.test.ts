import { describe, expect, it } from "vitest";
import { returnPath } from "./return-path";

describe("the page to return to after signing in", () => {
  it("is_a_path_of_the_console_with_its_query", () => {
    expect(returnPath("/runs?phase=faulted")).toBe("/runs?phase=faulted");
  });

  it.each([
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["evil"],
    ["/.//evil.example"],
    ["/..//evil.example"],
    ["/%2e//evil.example"],
    ["/.\\/evil.example"],
    ["/a/..//evil.example"],
    ["%2F%2Fevil.example"],
    ["/.\t//evil.example"],
  ])("never_leaves_the_console_for_%j", (next) => {
    const path = returnPath(next);

    expect(path).toBe("/");
  });

  it("an_encoded_slash_stays_a_character_of_the_path", () => {
    const path = returnPath("/%2F%2Fevil.example");

    expect(path).toBe("/%2F%2Fevil.example");
  });

  it("without_one_it_is_the_start_page", () => {
    expect(returnPath(undefined)).toBe("/");
  });
});
