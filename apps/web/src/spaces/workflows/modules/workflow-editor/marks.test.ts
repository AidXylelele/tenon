import type { Step, StructureResult } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { marksOf } from "./marks";

const FETCH: Step = {
  id: "/do/fetch",
  pointer: "/do/0/fetch",
  name: "fetch",
  kind: "call",
  variant: "http",
  family: "call",
  summary: "GET",
  milliseconds: null,
  note: null,
  range: { start: { line: 3, character: 2 }, end: { line: 8, character: 0 } },
  selectionRange: null,
  lists: [],
  flow: [],
  catch: null,
};

const STRUCTURE: StructureResult = {
  version: 1,
  stale: false,
  workflow: {
    namespace: "sales",
    name: "leads",
    title: null,
    triggers: [],
    steps: { id: "/do", pointer: "/do", role: "sequence", steps: [FETCH] },
  },
};

function errorAt(line: number, pointer: string, message: string): Diagnostic {
  const at = { line, character: 6 };
  return {
    range: { start: at, end: at },
    severity: DiagnosticSeverity.Error,
    message,
    data: { pointer },
  };
}

const MISSING_ADDRESS = errorAt(5, "/do/0/fetch/with/endpoint", "Required");

describe("the marks a step's problems put on the flow", () => {
  it("before_a_test_or_publish_an_empty_field_asks_to_be_filled_in", () => {
    const marks = marksOf(STRUCTURE, [MISSING_ADDRESS], false);

    expect(marks.get("/do/fetch")).toEqual({
      kind: "fill",
      missing: "address",
    });
  });

  it("after_a_test_or_publish_it_is_a_problem_with_its_count", () => {
    const other = errorAt(6, "/do/0/fetch/with/method", "Unknown method");

    const marks = marksOf(STRUCTURE, [MISSING_ADDRESS, other], true);

    expect(marks.get("/do/fetch")).toEqual({
      kind: "problem",
      count: 2,
      message: "Required",
      missing: "address",
    });
  });

  it("a_problem_outside_every_step_marks_none", () => {
    const outside = errorAt(1, "/document/version", "Not a version");

    const marks = marksOf(STRUCTURE, [outside], true);

    expect(marks.size).toBe(0);
  });

  it("without_a_structure_nothing_is_marked", () => {
    const marks = marksOf(null, [MISSING_ADDRESS], true);

    expect(marks.size).toBe(0);
  });
});
