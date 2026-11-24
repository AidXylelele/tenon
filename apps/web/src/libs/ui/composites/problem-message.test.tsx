import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Problem } from "@/libs/data-access/problem";
import { ProblemMessage } from "./problem-message";

const PROBLEM: Problem = {
  type: "urn:problem:definition.invalid",
  title: "The workflow definition is invalid",
  status: 422,
  detail: "must have required property endpoint",
  errors: [
    {
      pointer: "/do/0/fetch/with",
      detail: "must have required property endpoint",
      line: null,
      column: null,
    },
    {
      pointer: "/schedule/cron",
      detail: "Invalid cron expression",
      line: null,
      column: null,
    },
  ],
  retryAfter: null,
};

describe("a refusal of the API on the page", () => {
  it("shows_its_title_detail_and_each_other_location_in_words", () => {
    render(<ProblemMessage problem={PROBLEM} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The workflow definition is invalid",
    );
    expect(
      screen.getByText("must have required property endpoint"),
    ).toBeInTheDocument();
    expect(screen.getByText("Invalid cron expression")).toBeInTheDocument();
    expect(screen.queryByText("/schedule/cron")).toBeNull();
  });

  it.each([
    ["an HTTP phrase", "Too Many Requests", "about:blank"],
    ["the same sentence", "The current password is wrong", "urn:problem:x"],
  ])("a_title_that_is_%s_is_left_out", (_, title, type) => {
    const detail = "The current password is wrong";
    const problem = { ...PROBLEM, type, title, detail, errors: [] };

    render(<ProblemMessage problem={problem} />);

    expect(screen.getByRole("alert")).toHaveTextContent(detail);
    expect(screen.getAllByText(detail)).toHaveLength(1);
    expect(screen.queryByText("Too Many Requests")).toBeNull();
  });

  it("without_a_refusal_it_shows_nothing", () => {
    const { container } = render(<ProblemMessage problem={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
