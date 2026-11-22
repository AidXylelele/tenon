import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, Session } from "@/libs/data-access/types";
import type { FoundWorkflow } from "./found-workflow";
import { CommandPalette } from "./command-palette";

const push = vi.fn<(href: string) => void>();
const searchable = vi.fn<() => Promise<FoundWorkflow[]>>();

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

function sessionOf(role: Role): Session {
  const user = { id: "user-1", email: "ada@example.com", name: "Ada", role };
  const author = role !== "viewer";
  const administrator = role === "admin";
  const capabilities = { author, operator: author, administrator };
  return { user, capabilities };
}

function renderFor(session: Session | null) {
  return render(<CommandPalette session={session} />);
}

function foundLead() {
  return screen.findByRole("option", { name: /route-lead/ });
}

function pressK(modifier: "metaKey" | "ctrlKey") {
  fireEvent.keyDown(window, { key: "k", [modifier]: true });
}

function optionNames(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

describe("the search of the console", () => {
  beforeEach(() => {
    push.mockReset();
    searchable.mockReset();
    searchable.mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal("fetch", answer);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("is_closed_until_asked_for_and_reads_nothing_meanwhile", () => {
    renderFor(sessionOf("viewer"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(searchable).not.toHaveBeenCalled();
  });

  it.each([
    ["Command", "metaKey" as const],
    ["Ctrl", "ctrlKey" as const],
  ])("%s_K_opens_it_and_reads_the_workflows", (_, modifier) => {
    renderFor(sessionOf("viewer"));

    pressK(modifier);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(searchable).toHaveBeenCalledTimes(1);
  });

  it("K_without_a_modifier_is_typing_and_opens_nothing", () => {
    renderFor(sessionOf("viewer"));

    fireEvent.keyDown(window, { key: "k" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("command_K_again_closes_it_without_reading_again", () => {
    renderFor(sessionOf("viewer"));

    pressK("metaKey");
    pressK("metaKey");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(searchable).toHaveBeenCalledTimes(1);
  });

  it("the_button_opens_it_and_each_opening_reads_again", () => {
    renderFor(sessionOf("viewer"));
    const button = screen.getByRole("button", {
      name: /Search workflows and pages/,
    });

    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(button);

    expect(searchable).toHaveBeenCalledTimes(2);
  });

  it("a_workflow_found_closes_the_search_and_opens_its_page", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(sessionOf("viewer"));
    pressK("metaKey");

    fireEvent.click(await foundLead());

    expect(push).toHaveBeenCalledWith("/workflows/sales/route-lead");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a_viewer_finds_the_workflows_the_pages_for_everyone_and_no_actions", async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(sessionOf("viewer"));
    pressK("metaKey");
    await foundLead();
    const options = optionNames();

    expect(options).toEqual([
      "route-leadsalesOn",
      "Home",
      "Workflows",
      "Runs",
      "Runs that faulted",
      "Account",
      "Platform",
    ]);
  });

  it("an_editor_finds_the_actions_and_the_pages_that_connect_automations", () => {
    renderFor(sessionOf("editor"));
    pressK("metaKey");
    const names = optionNames();

    expect(names.slice(0, 3)).toEqual([
      "New workflow",
      "New webhook",
      "Send a test event",
    ]);
    expect(names).toContain("Webhooks");
    expect(names).toContain("Secrets");
    expect(names).not.toContain("Invitations");
  });

  it("an_administrator_also_finds_the_invitations", () => {
    renderFor(sessionOf("admin"));
    pressK("metaKey");

    expect(optionNames()).toContain("Invitations");
  });

  it("the_arrow_keys_move_through_the_options_and_enter_opens_one", () => {
    renderFor(sessionOf("viewer"));
    pressK("metaKey");
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/workflows");
  });

  it("what_is_typed_narrows_the_options", () => {
    renderFor(sessionOf("viewer"));
    pressK("metaKey");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "faulted" },
    });

    expect(optionNames()).toEqual(["Runs that faulted"]);
  });
});
