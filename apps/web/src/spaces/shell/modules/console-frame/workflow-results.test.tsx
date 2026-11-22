import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Command,
  CommandInput,
  CommandList,
} from "@/libs/ui/components/command";
import type { FoundWorkflow } from "./found-workflow";
import { useWorkflowSearch, WorkflowResults } from "./workflow-results";

const searchable = vi.fn<() => Promise<FoundWorkflow[]>>();
const onGo = vi.fn<(href: string) => void>();
const push = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

async function answer(): Promise<Response> {
  const found = await searchable();
  return Response.json(found);
}

const lead: FoundWorkflow = {
  namespace: "sales",
  name: "route-lead",
  on: true,
  archived: false,
};
const charge: FoundWorkflow = {
  namespace: "billing",
  name: "charge-card",
  on: false,
  archived: true,
};

function Search() {
  const search = useWorkflowSearch();

  return (
    <>
      <button type="button" onClick={search.read}>
        Open
      </button>
      <Command>
        <CommandInput placeholder="Type a workflow" />
        <CommandList>
          <WorkflowResults search={search} onGo={onGo} />
        </CommandList>
      </Command>
    </>
  );
}

function deferred(): {
  readonly promise: Promise<FoundWorkflow[]>;
  readonly resolve: (found: FoundWorkflow[]) => void;
} {
  let resolve: (found: FoundWorkflow[]) => void = () => undefined;
  const promise = new Promise<FoundWorkflow[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("the workflows the search offers", () => {
  beforeEach(() => {
    searchable.mockReset();
    onGo.mockReset();
    push.mockReset();
    vi.stubGlobal("fetch", answer);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("nothing_is_read_before_the_search_opens", () => {
    render(<Search />);

    expect(searchable).not.toHaveBeenCalled();
    expect(screen.queryByText("Reading workflows…")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("a_line_says_they_are_read_until_the_first_answer_comes", async () => {
    const answer = deferred();
    searchable.mockReturnValue(answer.promise);
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const readingFirst = screen.queryByText("Reading workflows…") !== null;
    await act(async () => {
      answer.resolve([lead]);
      await answer.promise;
    });

    expect(readingFirst).toBe(true);
    expect(screen.queryByText("Reading workflows…")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /route-lead/ })).toBeVisible();
  });

  it("each_workflow_shows_its_name_its_namespace_and_whether_it_is_on_or_archived", async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const on = await screen.findByRole("option", { name: /route-lead/ });
    const off = screen.getByRole("option", { name: /charge-card/ });

    expect(on).toHaveTextContent("route-leadsalesOn");
    expect(off).toHaveTextContent("charge-cardbillingArchived");
    expect(off).not.toHaveTextContent("On");
  });

  it("a_workflow_opens_its_page", async () => {
    searchable.mockResolvedValue([lead]);
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(await screen.findByRole("option", { name: /route-lead/ }));

    expect(onGo).toHaveBeenCalledWith("/workflows/sales/route-lead");
  });

  it("a_workflow_is_found_by_its_namespace_as_well_as_its_name", async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("option", { name: /route-lead/ });
    fireEvent.change(screen.getByPlaceholderText("Type a workflow"), {
      target: { value: "billing" },
    });

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("charge-card");
  });

  it("each_opening_reads_them_again_and_keeps_the_last_list_meanwhile", async () => {
    const again = deferred();
    searchable.mockResolvedValueOnce([lead]).mockReturnValueOnce(again.promise);
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("option", { name: /route-lead/ });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const meanwhile = screen.getAllByRole("option").length;
    const readingAgain = screen.queryByText("Reading workflows…") !== null;
    await act(async () => {
      again.resolve([lead, charge]);
      await again.promise;
    });

    expect(searchable).toHaveBeenCalledTimes(2);
    expect(meanwhile).toBe(1);
    expect(readingAgain).toBe(false);
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("a_read_that_fails_says_so_instead_of_an_empty_list", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const said = await screen.findByText("Workflows could not be read.");

    expect(said).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("a_session_that_ended_opens_sign_in_saying_so", async () => {
    const redirected = new Response(null);
    Object.defineProperty(redirected, "type", { value: "opaqueredirect" });
    vi.stubGlobal("fetch", () => Promise.resolve(redirected));
    render(<Search />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith("/sign-in?reason=ended&next=%2F");
  });
});
