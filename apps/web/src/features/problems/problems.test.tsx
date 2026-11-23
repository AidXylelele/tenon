import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagnostic } from "vscode-languageserver-protocol";
import { Problems } from "./problems";

const noFixes = () => [];

const missing: Diagnostic = {
  range: {
    start: { line: 11, character: 4 },
    end: { line: 11, character: 9 },
  },
  severity: 1,
  message: "The task needs a name",
};

describe("the problems of the text", () => {
  it("none_reads_as_no_problems", () => {
    render(<Problems problems={[]} onShow={vi.fn()} fixesFor={noFixes} />);

    expect(screen.getByText("No problems.")).toBeInTheDocument();
  });

  it("a_problem_says_what_and_where_and_shows_its_place", () => {
    const onShow = vi.fn();
    render(
      <Problems problems={[missing]} onShow={onShow} fixesFor={noFixes} />,
    );

    fireEvent.click(screen.getByText("The task needs a name"));

    expect(screen.getByText("Line 12")).toBeInTheDocument();
    expect(onShow).toHaveBeenCalledWith(missing);
    expect(screen.queryByText("Quick fix")).not.toBeInTheDocument();
  });

  it("a_quick_fix_shows_only_where_the_server_offers_one_and_applies", async () => {
    const apply = vi.fn();
    const fixes = [{ title: "Name it task1", apply }];
    const fixesFor = vi.fn(() => fixes);
    render(
      <Problems problems={[missing]} onShow={vi.fn()} fixesFor={fixesFor} />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Quick fix" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Name it task1" }),
    );

    expect(fixesFor).toHaveBeenCalledWith(missing);
    expect(apply).toHaveBeenCalled();
  });

  it.each([
    ["a_warning", 2],
    ["information", 3],
    ["a_hint", 4],
  ] as const)("%s_is_said_in_its_own_tone", (_, severity) => {
    const quiet = { ...missing, severity };

    render(<Problems problems={[quiet]} onShow={vi.fn()} fixesFor={noFixes} />);

    const message = screen.getByText("The task needs a name");
    expect(message).toBeInTheDocument();
  });
});
