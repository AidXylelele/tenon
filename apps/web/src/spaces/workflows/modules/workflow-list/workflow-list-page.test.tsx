import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  DAILY_DIGEST,
  MONTH_END,
  WORKFLOWS,
} from "../../__shared_context/workflows.test-support";
import {
  WorkflowListPage,
  type WorkflowListPageProps,
} from "./workflow-list-page";

const { startFromTemplateAction } = vi.hoisted(() => ({
  startFromTemplateAction: vi.fn<(id: string) => Promise<string>>(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/workflows" }));
vi.mock("./actions", () => ({ startFromTemplateAction }));

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
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} />
      </TooltipProvider>,
    );

    const create = screen.getByRole("link", { name: "New workflow" });
    expect(create).toHaveAttribute("href", "/workflows/new");
  });

  it("a_viewer_sees_no_create_action", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} author={false} />
      </TooltipProvider>,
    );

    const create = screen.queryByRole("link", { name: "New workflow" });
    expect(create).toBeNull();
  });

  it("a_scheduled_workflow_says_how_it_starts_and_that_it_is_on", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} />
      </TooltipProvider>,
    );

    const row = within(rowOf(DAILY_DIGEST.name));
    expect(row.getByText("On")).toBeInTheDocument();
    expect(row.getByText("Succeeded")).toBeInTheDocument();
  });

  it("a_workflow_never_published_reads_as_a_draft_never_run", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} />
      </TooltipProvider>,
    );

    const row = within(rowOf(MONTH_END.name));
    expect(row.getByText("Draft")).toBeInTheDocument();
    expect(row.getByText("Never run")).toBeInTheDocument();
    expect(row.getByText("By hand")).toBeInTheDocument();
  });

  it("an_empty_workspace_offers_three_templates_and_the_rest_on_ask", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} workflows={[]} />
      </TooltipProvider>,
    );

    const templates = screen.getByRole("list", { name: "Templates" });
    expect(within(templates).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(
      screen.getByRole("button", { name: "See all five templates" }),
    );
    expect(within(templates).getAllByRole("button")).toHaveLength(5);
    expect(
      screen.getByRole("link", { name: "start from scratch" }),
    ).toHaveAttribute("href", "/workflows/new");
    expect(screen.getByRole("link", { name: "New workflow" })).toBeVisible();
  });

  it("a_template_creates_its_draft_and_a_refusal_says_why", async () => {
    startFromTemplateAction.mockResolvedValue(
      "A workflow named daily-digest already has a draft.",
    );
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} workflows={[]} />
      </TooltipProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Every day, fetch a URL and post the result/,
      }),
    );

    expect(await screen.findByText(/already has a draft/)).toBeVisible();
    expect(startFromTemplateAction).toHaveBeenCalledWith("daily-digest");
  });

  it("an_event_start_shows_its_type_as_code", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} />
      </TooltipProvider>,
    );

    const type = screen.getByText("com.example.lead.created");
    expect(type).toHaveClass("font-mono");
  });

  it("an_empty_workspace_tells_a_viewer_who_publishes", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} workflows={[]} author={false} />
      </TooltipProvider>,
    );

    const note = screen.getByText(/once an editor publishes one/);
    expect(note).toBeInTheDocument();
  });

  it("a_search_with_no_match_offers_to_clear_it", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} workflows={[]} q="invoice" />
      </TooltipProvider>,
    );

    const clear = screen.getByRole("link", { name: "Clear the search" });
    expect(clear).toHaveAttribute("href", "/workflows");
  });

  it("the_archived_tab_says_what_archiving_keeps", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage {...LIST} workflows={[]} status="archived" />
      </TooltipProvider>,
    );

    const title = screen.getByText("No archived workflows");
    expect(title).toBeInTheDocument();
  });

  it("pages_link_to_the_first_and_the_next", () => {
    render(
      <TooltipProvider>
        <WorkflowListPage
          {...LIST}
          firstPage="/workflows"
          nextPage="/workflows?cursor=b"
        />
      </TooltipProvider>,
    );

    const next = screen.getByRole("link", { name: "Next page" });
    const first = screen.getByRole("link", { name: "First page" });
    expect(next).toHaveAttribute("href", "/workflows?cursor=b");
    expect(first).toHaveAttribute("href", "/workflows");
  });
});
