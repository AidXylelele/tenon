import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeStatusLine } from "./code-status-line";
import type { CodeProblem } from "./interfaces";

const UNCLOSED: CodeProblem = {
  line: 3,
  message: "“(” was never closed",
  severity: "error",
};

const UNUSED: CodeProblem = {
  line: 1,
  message: "“os” is imported but never used",
  severity: "warning",
};

describe("the status line under a code editor", () => {
  it("code_without_problems_says_so", () => {
    render(<CodeStatusLine problems={[]} note="Ruff" message="" />);

    const clean = screen.getByText("No problems");

    expect(clean).toBeVisible();
  });

  it("the_first_problem_is_named_by_its_line", () => {
    render(
      <CodeStatusLine problems={[UNCLOSED, UNUSED]} note="Ruff" message="" />,
    );

    const named = screen.getByText("Line 3: “(” was never closed");
    const other = screen.queryByText(/is imported but never used/);
    expect(named).toBeVisible();
    expect(other).not.toBeInTheDocument();
  });

  it("the_note_stands_beside_the_problems", () => {
    render(<CodeStatusLine problems={[]} note="Prettier" message="" />);

    const note = screen.getByText("Prettier");

    expect(note).toBeVisible();
  });

  it("the_message_is_shown_on_its_own_line", () => {
    render(
      <CodeStatusLine
        problems={[]}
        note="Prettier"
        message="Formatted with Prettier"
      />,
    );

    const message = screen.getByText("Formatted with Prettier");

    expect(message).toBeVisible();
  });
});
