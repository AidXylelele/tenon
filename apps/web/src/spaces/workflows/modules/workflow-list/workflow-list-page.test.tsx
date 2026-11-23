import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DAILY_DIGEST,
  MONTH_END,
  WORKFLOWS,
} from "../../__shared_context/workflows.test-support";
import {
  WorkflowListPage,
  type WorkflowListPageProps,
} from "./workflow-list-page";

vi.mock("next/navigation", () => ({ usePathname: () => "/workflows" }));

const LIST: WorkflowListPageProps = {
  status: "active",
  q: undefined,
  workflows: WORKFLOWS,
  author: true,
  firstPage: null,
  nextPage: null,
};

function rowOf(name: string): HTMLElement {
  const link = screen.getByRole("link", { name });
  const row = link.closest("tr");
  if (row === null) throw new Error(`No row for ${name}`);
  return row;
}

describe("the workflow list", () => {
  it("an_author_creates_a_workflow_from_the_header", () => {
    render(<WorkflowListPage {...LIST} />);

    const create = screen.getByRole("link", { name: "New workflow" });
    expect(create).toHaveAttribute("href", "/workflows/new");
  });

  it("a_viewer_sees_no_create_action", () => {
    render(<WorkflowListPage {...LIST} author={false} />);

    const create = screen.queryByRole("link", { name: "New workflow" });
    expect(create).toBeNull();
  });

  it("a_scheduled_workflow_says_how_it_starts_and_that_it_is_on", () => {
    render(<WorkflowListPage {...LIST} />);

    const row = within(rowOf(DAILY_DIGEST.name));
    expect(row.getByText("On")).toBeInTheDocument();
    expect(row.getByText("Succeeded")).toBeInTheDocument();
  });

  it("a_workflow_never_published_reads_as_a_draft_never_run", () => {
    render(<WorkflowListPage {...LIST} />);

    const row = within(rowOf(MONTH_END.name));
    expect(row.getByText("Draft")).toBeInTheDocument();
    expect(row.getByText("Never run")).toBeInTheDocument();
    expect(row.getByText("By hand")).toBeInTheDocument();
  });

  it("an_empty_workspace_leads_the_author_to_the_first_workflow", () => {
    render(<WorkflowListPage {...LIST} workflows={[]} />);

    const first = screen.getByRole("link", {
      name: "Create your first workflow",
    });
    const header = screen.queryByRole("link", { name: "New workflow" });
    expect(first).toHaveAttribute("href", "/workflows/new");
    expect(header).toBeNull();
  });

  it("an_empty_workspace_tells_a_viewer_who_publishes", () => {
    render(<WorkflowListPage {...LIST} workflows={[]} author={false} />);

    const note = screen.getByText(/once an editor publishes one/);
    expect(note).toBeInTheDocument();
  });

  it("a_search_with_no_match_offers_to_clear_it", () => {
    render(<WorkflowListPage {...LIST} workflows={[]} q="invoice" />);

    const clear = screen.getByRole("link", { name: "Clear the search" });
    expect(clear).toHaveAttribute("href", "/workflows");
  });

  it("the_archived_tab_says_what_archiving_keeps", () => {
    render(<WorkflowListPage {...LIST} workflows={[]} status="archived" />);

    const title = screen.getByText("No archived workflows");
    expect(title).toBeInTheDocument();
  });

  it("pages_link_to_the_first_and_the_next", () => {
    render(
      <WorkflowListPage
        {...LIST}
        firstPage="/workflows"
        nextPage="/workflows?cursor=b"
      />,
    );

    const next = screen.getByRole("link", { name: "Next page" });
    const first = screen.getByRole("link", { name: "First page" });
    expect(next).toHaveAttribute("href", "/workflows?cursor=b");
    expect(first).toHaveAttribute("href", "/workflows");
  });
});
