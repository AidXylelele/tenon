import { describe, expect, it } from "vitest";
import type { Diagnostic } from "vscode-languageserver-protocol";
import { diagnosticText, isSameDiagnostic } from "./diagnostic-text";

const MISSING: Diagnostic = {
  range: { start: { line: 4, character: 6 }, end: { line: 4, character: 10 } },
  message: "The address is missing",
};

describe("the words of a diagnostic", () => {
  it("plain_words_are_its_text", () => {
    const text = diagnosticText(MISSING);

    expect(text).toBe("The address is missing");
  });

  it("markdown_words_are_its_text", () => {
    const marked: Diagnostic = {
      range: MISSING.range,
      message: { kind: "markdown", value: "Fill in `endpoint`" },
    };

    const text = diagnosticText(marked);

    expect(text).toBe("Fill in `endpoint`");
  });

  it("the_same_words_at_the_same_start_are_the_same_diagnostic", () => {
    const again: Diagnostic = {
      range: {
        start: { line: 4, character: 6 },
        end: { line: 4, character: 40 },
      },
      message: "The address is missing",
    };

    const same = isSameDiagnostic(MISSING, again);

    expect(same).toBe(true);
  });

  it.each<[string, Diagnostic]>([
    [
      "another_line",
      {
        range: {
          start: { line: 5, character: 6 },
          end: { line: 5, character: 10 },
        },
        message: "The address is missing",
      },
    ],
    [
      "another_column",
      {
        range: {
          start: { line: 4, character: 7 },
          end: { line: 4, character: 10 },
        },
        message: "The address is missing",
      },
    ],
    ["other_words", { range: MISSING.range, message: "Unknown field" }],
  ])("a_diagnostic_at_%s_is_another", (_, other) => {
    const same = isSameDiagnostic(MISSING, other);

    expect(same).toBe(false);
  });
});
