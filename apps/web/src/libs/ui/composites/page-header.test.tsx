import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("the heading of a page", () => {
  it("names_the_page_with_its_meta_line_and_actions", () => {
    render(
      <PageHeader
        title="route-lead"
        description="sales/route-lead · version 1.2.0"
        actions={<button type="button">Run</button>}
      />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    const meta = screen.getByText("sales/route-lead · version 1.2.0");
    const run = screen.getByRole("button", { name: "Run" });
    expect(heading).toHaveTextContent("route-lead");
    expect(meta).toBeInTheDocument();
    expect(run).toBeInTheDocument();
  });

  it("a_tab_of_a_larger_page_names_itself_for_assistive_technologies_only", () => {
    render(<PageHeader title="Webhooks" level={2} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("sr-only");
  });
});
