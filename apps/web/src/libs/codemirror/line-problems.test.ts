import { diagnosticCount, forceLinting } from "@codemirror/lint";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeProblem } from "./interfaces";
import {
  isProblemsChange,
  lineProblemLinter,
  lineProblemsOf,
} from "./line-problems";

const UNCLOSED: CodeProblem = {
  line: 2,
  message: "“(” was never closed",
  severity: "error",
};

const views: EditorView[] = [];

function checkedEditor(
  problems: readonly CodeProblem[],
  seen: ViewUpdate[],
): EditorView {
  const check = vi.fn(() => Promise.resolve(problems));
  const listener = EditorView.updateListener.of((update) => {
    seen.push(update);
  });
  const checker = lineProblemLinter(check);
  const view = new EditorView({
    doc: "import json\nprint(json.dumps(1)\n",
    extensions: [checker, listener],
  });
  views.push(view);
  return view;
}

async function checked(view: EditorView): Promise<void> {
  forceLinting(view);
  await vi.waitFor(() => {
    const count = diagnosticCount(view.state);
    expect(count).toBeGreaterThan(0);
  });
}

describe("problems a checker reports by line", () => {
  afterEach(() => {
    for (const view of views) view.destroy();
    views.length = 0;
  });

  it("a_problem_marks_its_whole_line", async () => {
    const view = checkedEditor([UNCLOSED], []);

    await checked(view);

    const problems = lineProblemsOf(view.state);
    expect(problems).toEqual([UNCLOSED]);
  });

  it("the_checker_reads_the_whole_text", async () => {
    const unclosed: CodeProblem = {
      line: 1,
      message: "“(” was never closed",
      severity: "error",
    };
    const check = vi.fn(() => Promise.resolve([unclosed]));
    const checker = lineProblemLinter(check);
    const view = new EditorView({ doc: "x = (", extensions: [checker] });
    views.push(view);

    await checked(view);

    expect(check).toHaveBeenCalledWith("x = (");
  });

  it("marking_the_problems_is_a_change_of_problems", async () => {
    const seen: ViewUpdate[] = [];
    const view = checkedEditor([UNCLOSED], seen);

    await checked(view);

    const changed = seen.some(isProblemsChange);
    expect(changed).toBe(true);
  });

  it("typing_is_no_change_of_problems", () => {
    const seen: ViewUpdate[] = [];
    const view = checkedEditor([], seen);

    view.dispatch({ changes: { from: 0, insert: "#\n" } });

    const changed = seen.some(isProblemsChange);
    expect(changed).toBe(false);
  });

  it("an_editor_without_problems_has_none_by_line", () => {
    const view = checkedEditor([], []);

    const problems = lineProblemsOf(view.state);

    expect(problems).toEqual([]);
  });
});
