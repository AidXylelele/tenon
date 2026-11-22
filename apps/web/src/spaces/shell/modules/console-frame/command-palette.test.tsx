import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Capabilities } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { CommandPalette } from "./command-palette";
import type { FoundWorkflow } from "./found-workflow";

const push = vi.fn<(href: string) => void>();
const keepTheme = vi.fn<(chosen: string) => Promise<void>>();
const searchable = vi.fn<() => Promise<FoundWorkflow[]>>();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const VIEWER: Capabilities = {
  author: false,
  operator: false,
  administrator: false,
};
const EDITOR: Capabilities = {
  author: true,
  operator: true,
  administrator: false,
};
const ADMINISTRATOR: Capabilities = {
  author: true,
  operator: true,
  administrator: true,
};

const RUN_ID = "7c41e2d0-5b0e-4a13-9f2b-cf9b8fad0001";

const lead: FoundWorkflow = {
  namespace: "sales",
  name: "route-lead",
  on: true,
  archived: false,
};

async function answer(): Promise<Response> {
  const found = await searchable();
  return Response.json(found);
}

function renderFor(capabilities: Capabilities | null) {
  return render(
    <TooltipProvider>
      <button type="button">Elsewhere</button>
      <CommandPalette capabilities={capabilities} keepTheme={keepTheme} />
    </TooltipProvider>,
  );
}

function pressK(modifier: "metaKey" | "ctrlKey") {
  fireEvent.keyDown(window, { key: "k", [modifier]: true });
}

function pressEscape() {
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
}

function pressInField(key: string) {
  const field = screen.getByRole("combobox");
  fireEvent.keyDown(field, { key });
}

function pressCommandEnter() {
  const field = screen.getByRole("combobox");
  fireEvent.keyDown(field, { key: "Enter", metaKey: true });
}

function choose(name: string) {
  const option = screen.getByRole("option", { name });
  fireEvent.click(option);
}

async function chooseFound(name: RegExp) {
  const option = await screen.findByRole("option", { name });
  fireEvent.click(option);
}

function type(text: string) {
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: text } });
}

function optionNames(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function groupNames(): string[] {
  const groups = screen.getByRole("listbox").querySelectorAll("[cmdk-group]");
  return Array.from(groups).map(
    (group) => group.querySelector("[cmdk-group-heading]")?.textContent ?? "",
  );
}

describe("the search of the console", () => {
  beforeEach(() => {
    push.mockReset();
    keepTheme.mockReset();
    keepTheme.mockResolvedValue(undefined);
    searchable.mockReset();
    searchable.mockReturnValue(new Promise(() => undefined));
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    vi.stubGlobal("fetch", answer);
  });

  it("is_closed_until_asked_for_and_reads_nothing_meanwhile", () => {
    renderFor(VIEWER);

    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
    expect(searchable).not.toHaveBeenCalled();
  });

  it.each([
    ["Command", "metaKey" as const],
    ["Ctrl", "ctrlKey" as const],
  ])("%s_K_opens_it_on_its_field_and_reads_the_workflows", (_, modifier) => {
    renderFor(VIEWER);

    pressK(modifier);

    const field = screen.getByRole("combobox");
    expect(field).toHaveFocus();
    expect(searchable).toHaveBeenCalledTimes(1);
  });

  it("K_without_a_modifier_is_typing_and_opens_nothing", () => {
    renderFor(VIEWER);

    fireEvent.keyDown(window, { key: "k" });

    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
  });

  it("command_K_again_closes_it", () => {
    renderFor(VIEWER);

    pressK("metaKey");
    pressK("metaKey");

    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
  });

  it("closing_it_returns_focus_to_where_it_was", async () => {
    renderFor(VIEWER);
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    pressK("metaKey");

    pressEscape();

    await waitFor(() => {
      expect(elsewhere).toHaveFocus();
    });
  });

  it("the_search_button_opens_it_and_each_opening_reads_again", () => {
    renderFor(VIEWER);
    const button = screen.getByRole("button", { name: "Search" });

    fireEvent.click(button);
    pressEscape();
    fireEvent.click(button);

    expect(searchable).toHaveBeenCalledTimes(2);
  });

  it("a_viewer_finds_the_pages_for_everyone_and_the_theme_with_nothing_typed", () => {
    renderFor(VIEWER);

    pressK("metaKey");

    const options = optionNames();
    expect(options).toEqual([
      "Home",
      "Workflows",
      "Runs",
      "Settings",
      "Account",
      "Platform",
      "Switch to the dark theme",
    ]);
  });

  it("an_editor_finds_the_actions_in_the_order_of_the_design", () => {
    renderFor(EDITOR);
    pressK("metaKey");

    const names = optionNames();
    const last = names.slice(-6);

    expect(last).toEqual([
      "New workflow",
      "Run a workflow…",
      "Send a test event",
      "New secret",
      "New webhook",
      "Switch to the dark theme",
    ]);
    expect(names).toContain("Webhooks");
    expect(names).not.toContain("Invite someone");
  });

  it("an_administrator_also_finds_the_invitations_and_inviting_someone", () => {
    renderFor(ADMINISTRATOR);

    pressK("metaKey");

    const names = optionNames();
    expect(names).toContain("Invitations");
    expect(names).toContain("Invite someone");
  });

  it("what_is_typed_narrows_the_pages_and_actions_and_says_how_many", () => {
    renderFor(EDITOR);
    pressK("metaKey");

    type("secret");

    const options = optionNames();
    const status = screen.getByRole("status");
    expect(options).toEqual(["Secrets", "New secret"]);
    expect(status).toHaveTextContent("2 results");
  });

  it("a_search_that_matches_nothing_says_so_and_what_to_try", () => {
    renderFor(VIEWER);
    pressK("metaKey");

    type("zzzz");

    const said = screen.getByText(/Nothing matches “zzzz”/);
    const status = screen.getByRole("status");
    expect(said).toHaveTextContent(
      "Nothing matches “zzzz”. Try a workflow's name, a page, an action or a run ID.",
    );
    expect(status).toHaveTextContent("Nothing matches");
  });

  it("a_workflow_found_opens_its_page_and_comes_first_next_time", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(VIEWER);
    pressK("metaKey");
    type("route");

    await chooseFound(/route-lead/);
    pressK("metaKey");

    const [firstGroup] = groupNames();
    const [firstOption] = optionNames();
    expect(push).toHaveBeenCalledWith("/workflows/sales/route-lead");
    expect(firstGroup).toBe("Recent");
    expect(firstOption).toBe("route-lead");
  });

  it("a_page_chosen_opens_and_comes_first_next_time", () => {
    renderFor(VIEWER);
    pressK("metaKey");

    choose("Runs");
    pressK("metaKey");

    const [first] = optionNames();
    expect(push).toHaveBeenCalledWith("/runs");
    expect(first).toBe("Runs");
  });

  it("a_recent_visit_opens_again", () => {
    const stored = JSON.stringify([
      { label: "Platform", href: "/settings/platform" },
    ]);
    window.localStorage.setItem("console.recent", stored);
    renderFor(VIEWER);
    pressK("metaKey");

    const recent = screen.getByRole("group", { name: "Recent" });
    const platform = within(recent).getByRole("option", { name: "Platform" });

    fireEvent.click(platform);

    expect(push).toHaveBeenCalledWith("/settings/platform");
  });

  it.each([
    ["text_that_is_not_json", "not json"],
    ["json_of_another_shape", '{"label":"Runs"}'],
  ])("recent_visits_kept_as_%s_are_left_out", (_, stored) => {
    window.localStorage.setItem("console.recent", stored);
    renderFor(VIEWER);

    pressK("metaKey");

    const groups = groupNames();
    expect(groups).toEqual(["Go to", "Actions"]);
  });

  it("an_action_that_is_a_page_opens_it", () => {
    renderFor(EDITOR);
    pressK("metaKey");

    choose("New workflow");

    expect(push).toHaveBeenCalledWith("/workflows/new");
  });

  it("command_enter_on_a_workflow_opens_its_editor_for_an_editor", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(EDITOR);
    pressK("metaKey");
    type("route-lead");
    await screen.findByRole("option", { name: /route-lead/ });

    pressCommandEnter();

    expect(push).toHaveBeenCalledWith("/workflows/sales/route-lead/edit");
  });

  it("command_enter_opens_no_editor_for_a_viewer", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(VIEWER);
    pressK("metaKey");
    type("route-lead");
    await screen.findByRole("option", { name: /route-lead/ });

    pressCommandEnter();

    expect(push).not.toHaveBeenCalledWith("/workflows/sales/route-lead/edit");
  });

  it("a_run_id_typed_opens_that_run", () => {
    renderFor(VIEWER);
    pressK("metaKey");
    type(RUN_ID);

    choose("Run 7c41e2d0");

    expect(push).toHaveBeenCalledWith(`/runs/${RUN_ID}`);
  });

  it("run_a_workflow_lists_the_workflows_and_opens_the_chosen_one_ready_to_run", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(EDITOR);
    pressK("metaKey");
    choose("Run a workflow…");

    await chooseFound(/route-lead/);

    expect(push).toHaveBeenCalledWith("/workflows/sales/route-lead?start=1");
  });

  it("backspace_in_an_empty_field_goes_back_from_running_to_everything", () => {
    renderFor(EDITOR);
    pressK("metaKey");
    choose("Run a workflow…");

    pressInField("Backspace");

    const options = optionNames();
    expect(options).toContain("New workflow");
  });

  it("switching_the_theme_shows_it_at_once_and_keeps_it", () => {
    renderFor(VIEWER);
    pressK("metaKey");

    choose("Switch to the dark theme");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(keepTheme).toHaveBeenCalledWith("dark");
  });
});
