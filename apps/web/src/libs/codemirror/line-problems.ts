import {
  type Diagnostic,
  forEachDiagnostic,
  linter,
  setDiagnosticsEffect,
} from "@codemirror/lint";
import type { EditorState, Extension, Text } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import type { CodeProblem } from "./interfaces";

export type LineCheck = (text: string) => Promise<readonly CodeProblem[]>;

export function lineProblemLinter(check: LineCheck): Extension {
  return linter(async (view) => {
    const doc = view.state.doc;
    const text = doc.toString();
    const problems = await check(text);
    return problems.map((problem) => markOf(problem, doc));
  });
}

export function lineProblemsOf(state: EditorState): readonly CodeProblem[] {
  const problems: CodeProblem[] = [];
  forEachDiagnostic(state, (diagnostic, from) => {
    const line = state.doc.lineAt(from).number;
    problems.push({
      line,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  });
  return problems;
}

export function isProblemsChange(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(setDiagnosticsEffect)),
  );
}

function markOf(problem: CodeProblem, doc: Text): Diagnostic {
  const line = doc.line(problem.line);
  return {
    from: line.from,
    to: line.to,
    severity: problem.severity,
    message: problem.message,
  };
}
