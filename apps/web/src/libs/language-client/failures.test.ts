import { describe, expect, it } from "vitest";
import { isOutdated, reasonOf } from "./failures";

describe("a language server's failures", () => {
  it.each<[string, unknown, boolean]>([
    ["content_modified", { code: -32801, message: "Content modified" }, true],
    ["another_code", { code: -32603, message: "Internal error" }, false],
    ["no_code", new Error("gone"), false],
    ["not_an_object", "gone", false],
  ])("a_failure_with_%s_is_outdated_%s", (_, failure, expected) => {
    const outdated = isOutdated(failure);

    expect(outdated).toBe(expected);
  });

  it.each<[string, unknown, string]>([
    ["an_error", new Error("The server stopped."), "The server stopped."],
    ["a_message", { code: 1, message: "Refused" }, "Refused"],
    ["text", "gone", "gone"],
    ["nothing", null, "null"],
  ])("the_reason_of_%s_is_its_words", (_, failure, expected) => {
    const reason = reasonOf(failure);

    expect(reason).toBe(expected);
  });
});
