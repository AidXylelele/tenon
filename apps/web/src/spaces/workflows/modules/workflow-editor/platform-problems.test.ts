import { forEachDiagnostic, setDiagnostics } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import type { Problem } from "@/libs/data-access/problem";
import { markPlatformProblems, platformProblemsOf } from "./platform-problems";

const TEXT = [
  "document:",
  "  dsl: 1.0.0",
  "schedule:",
  '  cron: "0 18 30 2 *"',
  "do: []",
].join("\n");

const NEVER_FIRES = "The cron 0 18 30 2 * never fires";

const POINTED = {
  start: { line: 2, character: 0 },
  end: { line: 2, character: 9 },
};

const REFUSAL: Problem = {
  type: "urn:problem:definition.invalid",
  title: "The workflow definition is invalid",
  status: 422,
  detail: NEVER_FIRES,
  errors: [
    { pointer: "/schedule/cron", detail: NEVER_FIRES, line: 4, column: 9 },
    {
      pointer: "/schedule",
      detail: "Placed by pointer",
      line: null,
      column: null,
    },
    { pointer: "/use", detail: "Placed nowhere", line: null, column: null },
  ],
  retryAfter: null,
};

const LANGUAGE_SERVER_MARK = {
  from: 0,
  to: 8,
  severity: "warning" as const,
  message: "Name the workflow",
};

interface SeenMark {
  readonly from: number;
  readonly to: number;
  readonly message: string;
}

const views: EditorView[] = [];

function editor(): EditorView {
  const view = new EditorView({ doc: TEXT });
  const marked = setDiagnostics(view.state, [LANGUAGE_SERVER_MARK]);
  view.dispatch(marked);
  views.push(view);
  return view;
}

function marksOn(view: EditorView): readonly SeenMark[] {
  const seen: SeenMark[] = [];
  forEachDiagnostic(view.state, (mark, from, to) => {
    seen.push({ from, to, message: mark.message });
  });
  return seen;
}

describe("the platform's problems", () => {
  afterEach(() => {
    for (const view of views) view.destroy();
    views.length = 0;
  });

  it("a_refusal_reads_as_an_error_at_its_line_and_column", () => {
    const [first] = platformProblemsOf(REFUSAL, [null, null, null]);

    expect(first).toEqual({
      range: {
        start: { line: 3, character: 8 },
        end: { line: 3, character: 8 },
      },
      severity: DiagnosticSeverity.Error,
      source: "platform",
      message: NEVER_FIRES,
      data: { pointer: "/schedule/cron" },
    });
  });

  it("a_refusal_without_a_line_is_placed_by_its_pointer_or_else_at_the_top", () => {
    const problems = platformProblemsOf(REFUSAL, [null, POINTED, null]);
    const starts = problems.map((problem) => problem.range.start);

    expect(starts).toEqual([
      { line: 3, character: 8 },
      POINTED.start,
      { line: 0, character: 0 },
    ]);
  });

  it("they_mark_their_line_and_column_beside_the_language_server's", () => {
    const view = editor();
    const problems = platformProblemsOf(REFUSAL, [null, POINTED, null]);
    const cron = view.state.doc.line(4).from + 8;
    const schedule = view.state.doc.line(3);

    markPlatformProblems(view, problems);

    expect(marksOn(view)).toEqual([
      { from: 0, to: 0, message: "Placed nowhere" },
      { from: 0, to: 8, message: "Name the workflow" },
      { from: schedule.from, to: schedule.to, message: "Placed by pointer" },
      { from: cron, to: cron, message: NEVER_FIRES },
    ]);
  });

  it("marking_again_replaces_the_earlier_refusal's_marks", () => {
    const view = editor();
    const problems = platformProblemsOf(REFUSAL, [null, null, null]);
    markPlatformProblems(view, problems);

    markPlatformProblems(view, []);

    expect(marksOn(view)).toEqual([
      { from: 0, to: 8, message: "Name the workflow" },
    ]);
  });

  it("a_place_past_the_text_is_kept_inside_it", () => {
    const view = editor();
    const far = { line: 40, character: 99 };
    const beyond: Diagnostic = {
      range: { start: far, end: far },
      severity: DiagnosticSeverity.Error,
      source: "platform",
      message: NEVER_FIRES,
    };
    const end = view.state.doc.length;

    markPlatformProblems(view, [beyond]);

    expect(marksOn(view)).toContainEqual({
      from: end,
      to: end,
      message: NEVER_FIRES,
    });
  });
});
