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
const onChoose = vi.fn<(workflow: FoundWorkflow) => void>();
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
          <WorkflowResults search={search} onChoose={onChoose} />
        </CommandList>
      </Command>
    </>
  );
}

function openSearch() {
  const button = screen.getByRole("button", { name: "Open" });
  fireEvent.click(button);
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
    onChoose.mockReset();
    push.mockReset();
    vi.stubGlobal("fetch", answer);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("nothing_is_read_before_the_search_opens", () => {
    render(<Search />);

    const reading = screen.queryByText("Reading workflows…");
    const options = screen.queryAllByRole("option");
    expect(searchable).not.toHaveBeenCalled();
    expect(reading).not.toBeInTheDocument();
    expect(options).toHaveLength(0);
  });

  it("a_line_says_they_are_read_until_the_first_answer_comes", async () => {
    const answer = deferred();
    searchable.mockReturnValue(answer.promise);
    render(<Search />);

    openSearch();
    const readingFirst = screen.queryByText("Reading workflows…") !== null;
    await act(async () => {
      answer.resolve([lead]);
      await answer.promise;
    });

    const reading = screen.queryByText("Reading workflows…");
    const found = screen.getByRole("option", { name: /route-lead/ });
    expect(readingFirst).toBe(true);
    expect(reading).not.toBeInTheDocument();
    expect(found).toBeVisible();
  });

  it("each_workflow_shows_its_name_its_namespace_and_whether_it_is_on_or_archived", async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    openSearch();
    const on = await screen.findByRole("option", { name: /route-lead/ });
    const off = screen.getByRole("option", { name: /charge-card/ });

    expect(on).toHaveTextContent("route-leadsalesOn");
    expect(off).toHaveTextContent("charge-cardbillingArchived");
    expect(off).not.toHaveTextContent("On");
  });

  it("a_workflow_chosen_is_handed_over_whole", async () => {
    searchable.mockResolvedValue([lead]);
    render(<Search />);

    openSearch();
    const found = await screen.findByRole("option", { name: /route-lead/ });
    fireEvent.click(found);

    expect(onChoose).toHaveBeenCalledWith(lead);
  });

  it("a_workflow_is_found_by_its_namespace_as_well_as_its_name", async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    openSearch();
    await screen.findByRole("option", { name: /route-lead/ });
    const field = screen.getByPlaceholderText("Type a workflow");
    fireEvent.change(field, { target: { value: "billing" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("charge-card");
  });

  it("each_opening_reads_them_again_and_keeps_the_last_list_meanwhile", async () => {
    const again = deferred();
    searchable.mockResolvedValueOnce([lead]).mockReturnValueOnce(again.promise);
    render(<Search />);

    openSearch();
    await screen.findByRole("option", { name: /route-lead/ });
    openSearch();
    const meanwhile = screen.getAllByRole("option").length;
    const readingAgain = screen.queryByText("Reading workflows…") !== null;
    await act(async () => {
      again.resolve([lead, charge]);
      await again.promise;
    });

    expect(searchable).toHaveBeenCalledTimes(2);
    const options = screen.getAllByRole("option");
    expect(meanwhile).toBe(1);
    expect(readingAgain).toBe(false);
    expect(options).toHaveLength(2);
  });

  it("a_read_that_fails_says_so_instead_of_an_empty_list", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
    render(<Search />);

    openSearch();
    const said = await screen.findByText("Workflows could not be read.");

    const options = screen.queryAllByRole("option");
    expect(said).toBeInTheDocument();
    expect(options).toHaveLength(0);
  });

  it.each([
    ["an_answer_that_is_not_ok", () => Response.json([], { status: 503 })],
    ["an_answer_of_another_shape", () => Response.json([{ name: 1 }])],
  ])("%s_says_the_workflows_could_not_be_read", async (_, answered) => {
    vi.stubGlobal("fetch", () => Promise.resolve(answered()));
    render(<Search />);

    openSearch();

    const said = await screen.findByText("Workflows could not be read.");
    expect(said).toBeInTheDocument();
  });

  it("a_session_that_ended_opens_sign_in_saying_so", async () => {
    const redirected = new Response(null);
    Object.defineProperty(redirected, "type", { value: "opaqueredirect" });
    vi.stubGlobal("fetch", () => Promise.resolve(redirected));
    render(<Search />);

    openSearch();
    await act(async () => {
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith("/sign-in?reason=ended&next=%2F");
  });
});
