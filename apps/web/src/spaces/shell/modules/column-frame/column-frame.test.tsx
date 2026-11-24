import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnFrame } from "./column-frame";

describe("the frame of a column page", () => {
  it("holds_the_page", () => {
    render(
      <ColumnFrame>
        <h1>Runs</h1>
      </ColumnFrame>,
    );

    const heading = screen.getByRole("heading", { name: "Runs" });
    expect(heading).toBeInTheDocument();
  });
});
