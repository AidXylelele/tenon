import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnLoading } from "./column-loading";

describe("a column page that is still loading", () => {
  it("says_it_is_loading", () => {
    render(<ColumnLoading />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
  });
});
