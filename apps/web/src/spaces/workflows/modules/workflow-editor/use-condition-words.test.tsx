import { renderHook, waitFor } from "@testing-library/react";
import type { DataAtResult, Step, Transition } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowSession } from "@/operations/workflow-language";
import {
  BEFORE_TODAY,
  TWO_ROWS_ALL,
  WRITTEN_BEFORE_A_TEST,
} from "./condition-builder/readings.test-support";
import { useConditionWords } from "./use-condition-words";

const SAMPLES = {};

function caseOf(name: string, condition: Transition["condition"]): Transition {
  return {
    on: "case",
    case: name,
    when: "${ … }",
    condition,
    kind: "next",
    to: null,
  };
}

const OTHERWISE: Transition = {
  on: "case",
  case: "Otherwise",
  when: null,
  condition: null,
  kind: "end",
  to: null,
};

const EXPRESSION: Transition = caseOf("Written", {
  kind: "expression",
  text: "${ .a | length > 0 }",
});

const ROUTE: Step = {
  id: "/do/Route",
  pointer: "/do/1/Route",
  name: "Route",
  kind: "switch",
  variant: null,
  family: "flow",
  summary: null,
  milliseconds: null,
  note: null,
  range: null,
  selectionRange: null,
  lists: [],
  flow: [
    caseOf("Has slides", TWO_ROWS_ALL),
    EXPRESSION,
    caseOf("Due/late", BEFORE_TODAY),
    OTHERWISE,
  ],
  catch: null,
};

function sessionOf(data: DataAtResult) {
  const dataAt = vi.fn(() => Promise.resolve(data));
  const session = { dataAt } as unknown as WorkflowSession;

  return { session, dataAt };
}

describe("the flow's conditions in words", () => {
  it("words_each_branch_written_as_rows_by_the_data_at_its_condition", async () => {
    const { session, dataAt } = sessionOf(WRITTEN_BEFORE_A_TEST);
    const steps = [ROUTE];

    const { result } = renderHook(() =>
      useConditionWords(session, steps, SAMPLES),
    );

    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });
    const words = result.current.get("/do/Route");
    expect(words?.get("Has slides")).toBe(
      "Fetch the digest › slideshow › slides is not empty and Fetch the digest › slideshow › title is “Sample Slide Show”",
    );
    expect(words?.get("Due/late")).toBe(
      "Fetch the digest › due is less than today and Fetch the digest › owner is The workflow's input",
    );
    expect(words?.has("Written")).toBe(false);
    expect(dataAt.mock.calls).toEqual([
      ["/do/Route", "/do/1/Route/switch/0/Has slides/when", SAMPLES, ""],
      ["/do/Route", "/do/1/Route/switch/2/Due~1late/when", SAMPLES, ""],
    ]);
  });
});
