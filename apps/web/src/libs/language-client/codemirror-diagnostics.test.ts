import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import type { ProblemSeverity } from "@/libs/codemirror/interfaces";
import { codeProblemsOf, lintDiagnosticsOf } from "./codemirror-diagnostics";

const SCRIPT = Text.of([
  "import json",
  'score = 10 if lead.get("email") else 0',
  'print(json.dumps({"score": score})',
]);

const UNCLOSED: Diagnostic = {
  range: { start: { line: 2, character: 5 }, end: { line: 2, character: 6 } },
  severity: DiagnosticSeverity.Error,
  message: "“(” was never closed",
};

describe("language server diagnostics as codemirror's", () => {
  it("a_diagnostic_marks_its_range_with_its_words", () => {
    const marks = lintDiagnosticsOf([UNCLOSED], SCRIPT);

    expect(marks).toEqual([
      { from: 56, to: 57, severity: "error", message: "“(” was never closed" },
    ]);
  });

  it.each<[DiagnosticSeverity | undefined, ProblemSeverity]>([
    [DiagnosticSeverity.Error, "error"],
    [DiagnosticSeverity.Warning, "warning"],
    [DiagnosticSeverity.Information, "info"],
    [DiagnosticSeverity.Hint, "hint"],
    [undefined, "error"],
  ])("severity_%s_is_codemirrors_%s", (severity, expected) => {
    const diagnostic: Diagnostic = {
      range: UNCLOSED.range,
      severity,
      message: "“(” was never closed",
    };

    const [mark] = lintDiagnosticsOf([diagnostic], SCRIPT);

    expect(mark?.severity).toBe(expected);
  });

  it("a_position_past_the_last_line_is_the_end_of_the_text", () => {
    const past: Diagnostic = {
      range: {
        start: { line: 9, character: 40 },
        end: { line: 9, character: 41 },
      },
      message: "Expected an expression",
    };

    const marks = lintDiagnosticsOf([past], SCRIPT);

    expect(marks).toEqual([
      {
        from: 85,
        to: 85,
        severity: "error",
        message: "Expected an expression",
      },
    ]);
  });

  it("a_column_past_the_end_of_its_line_is_the_end_of_that_line", () => {
    const wide: Diagnostic = {
      range: {
        start: { line: 0, character: 4 },
        end: { line: 0, character: 99 },
      },
      message: "“json” is imported but never used",
    };

    const [mark] = lintDiagnosticsOf([wide], SCRIPT);

    expect(mark?.to).toBe(11);
  });

  it("a_diagnostic_in_markdown_keeps_its_words", () => {
    const marked: Diagnostic = {
      range: UNCLOSED.range,
      message: { kind: "markdown", value: "Close the `(`" },
    };

    const [mark] = lintDiagnosticsOf([marked], SCRIPT);

    expect(mark?.message).toBe("Close the `(`");
  });

  it("a_problem_is_named_by_its_line_counted_from_one", () => {
    const problems = codeProblemsOf([UNCLOSED]);

    expect(problems).toEqual([
      { line: 3, message: "“(” was never closed", severity: "error" },
    ]);
  });
});
