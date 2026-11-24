import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ViewerLine, ViewerNotice } from "./viewer-notice";

describe("telling a viewer what they can do", () => {
  it("the_notice_says_what_the_page_is_for_and_whom_to_ask", () => {
    render(<ViewerNotice what="Secrets hold tokens." />);

    expect(screen.getByText("For editors and administrators")).toBeVisible();
    expect(
      screen.getByText(
        "Secrets hold tokens. Viewers read workflows and runs. Ask an administrator for the editor role.",
      ),
    ).toBeVisible();
  });

  it("the_line_says_what_viewers_do", () => {
    render(<ViewerLine />);

    expect(screen.getByText("Viewers read workflows and runs.")).toBeVisible();
  });
});
