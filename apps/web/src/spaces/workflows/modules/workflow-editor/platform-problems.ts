import {
  type Diagnostic as Mark,
  forEachDiagnostic,
  setDiagnostics,
} from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type Position,
  type Range,
} from "vscode-languageserver-protocol";
import type { Problem } from "@/libs/data-access/problem";
import { diagnosticText } from "@/libs/language-client/diagnostic-text";

const PLATFORM = "platform";

const TOP: Position = { line: 0, character: 0 };

const AT_THE_TOP: Range = { start: TOP, end: TOP };

export function platformProblemsOf(
  problem: Problem,
  pointed: readonly (Range | null)[],
): readonly Diagnostic[] {
  return problem.errors.map((error, index) => {
    const byPointer = pointed[index] ?? AT_THE_TOP;
    const range =
      error.line === null ? byPointer : rangeAt(error.line, error.column);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      source: PLATFORM,
      message: error.detail,
      data: { pointer: error.pointer },
    };
  });
}

export function markPlatformProblems(
  view: EditorView,
  problems: readonly Diagnostic[],
): void {
  const state = view.state;
  const kept: Mark[] = [];
  forEachDiagnostic(state, (mark, from, to) => {
    if (mark.source !== PLATFORM) kept.push({ ...mark, from, to });
  });
  const added = problems.map((problem) => markOf(problem, state.doc));
  const marks = [...kept, ...added];
  const marked = setDiagnostics(state, marks);
  view.dispatch(marked);
}

function rangeAt(line: number, column: number | null): Range {
  const start = { line: line - 1, character: (column ?? 1) - 1 };
  return { start, end: start };
}

function markOf(problem: Diagnostic, doc: Text): Mark {
  const from = offsetOf(problem.range.start, doc);
  const to = offsetOf(problem.range.end, doc);
  const message = diagnosticText(problem);
  return { from, to, severity: "error", message, source: PLATFORM };
}

function offsetOf(position: Position, doc: Text): number {
  const number = Math.min(position.line + 1, doc.lines);
  const line = doc.line(number);
  return Math.min(line.from + position.character, line.to);
}
