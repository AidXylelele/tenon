import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import { TENON_VARIANTS, WITHOUT_SHELL } from "./hosts.test-support";
import type { EntryAction, StepCatalogProps } from "./interfaces";
import { StepCatalog } from "./step-catalog";

type Shown = Omit<StepCatalogProps, "onChoose">;

interface Owner {
  readonly onChoose: Mock<(action: EntryAction) => void>;
}

const AFTER_FETCH: Shown = {
  variants: TENON_VARIANTS,
  stepAbove: "Fetch the digest",
  languageTerms: false,
};

const AFTER_THE_START: Shown = {
  variants: TENON_VARIANTS,
  stepAbove: null,
  languageTerms: false,
};

const HOST_WITHOUT_SHELL: Shown = {
  variants: WITHOUT_SHELL,
  stepAbove: "Fetch the digest",
  languageTerms: false,
};

function openCatalog(shown: Shown): Owner {
  const onChoose = vi.fn<(action: EntryAction) => void>();
  render(<StepCatalog {...shown} onChoose={onChoose} />);
  return { onChoose };
}

function searchBox(): HTMLElement {
  return screen.getByRole("combobox", { name: "Find a kind of step" });
}

function search(query: string): void {
  const box = searchBox();
  fireEvent.change(box, { target: { value: query } });
}

function press(key: string): void {
  const box = searchBox();
  fireEvent.keyDown(box, { key });
}

describe("the step catalog at a plus", () => {
  it("the_search_takes_focus_as_a_combobox_over_the_kinds_of_step", () => {
    openCatalog(AFTER_FETCH);

    const box = searchBox();
    const list = screen.getByRole("listbox", { name: "Kinds of step" });
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute("aria-controls", list.id);
  });

  it("common_is_the_one_open_group_with_its_entries_in_order", () => {
    openCatalog(AFTER_FETCH);

    const list = screen.getByRole("listbox", { name: "Kinds of step" });
    const groups = within(list).getAllByRole("group");
    const entries = within(list).getAllByRole("option");
    const fetch = screen.getByRole("option", {
      name: /^Fetch or send to a URL/,
    });
    const choose = screen.getByRole("option", { name: /^Choose a path/ });
    const repeat = screen.getByRole("option", {
      name: /^Repeat for each item/,
    });
    const set = screen.getByRole("option", { name: /^Set data/ });
    const wait = screen.getByRole("option", { name: /^Wait/ });
    const javascript = screen.getByRole("option", { name: /^Run JavaScript/ });
    const retry = screen.getByRole("option", {
      name: /^Retry “Fetch the digest” if it fails/,
    });
    const start = screen.getByRole("option", {
      name: /^Change how the workflow starts/,
    });
    expect(groups).toHaveLength(1);
    expect(entries).toEqual([
      fetch,
      choose,
      repeat,
      set,
      wait,
      javascript,
      retry,
      start,
    ]);
  });

  it("an_entry_shows_a_line_and_an_example", () => {
    openCatalog(AFTER_FETCH);

    const wait = screen.getByRole("option", { name: /^Wait/ });

    const line = within(wait).getByText("Pause for a while");
    const example = within(wait).getByText("30 minutes");
    expect(line).toBeVisible();
    expect(example).toBeVisible();
  });

  it("the_other_groups_wait_closed_outside_the_list_with_their_counts", () => {
    openCatalog(AFTER_FETCH);

    const list = screen.getByRole("listbox", { name: "Kinds of step" });
    const toggles = screen.getAllByRole("button", { expanded: false });
    const inList = within(list).queryAllByRole("button");
    const decide = screen.getByRole("button", {
      name: "Decide and repeat, 3 kinds of step",
    });
    const code = screen.getByRole("button", {
      name: "Run code, 3 kinds of step",
    });
    const events = screen.getByRole("button", {
      name: "Wait and events, 3 kinds of step",
    });
    const developers = screen.getByRole("button", {
      name: "For developers, 5 kinds of step",
    });
    expect(toggles).toEqual([decide, code, events, developers]);
    expect(inList).toEqual([]);
  });

  it("opening_a_group_lists_its_entries_and_returns_focus_to_the_search", () => {
    openCatalog(AFTER_FETCH);
    const toggle = screen.getByRole("button", {
      name: "Decide and repeat, 3 kinds of step",
    });

    fireEvent.click(toggle);

    const list = screen.getByRole("listbox", { name: "Kinds of step" });
    const decide = within(list).getByRole("group", {
      name: "Decide and repeat",
    });
    const box = searchBox();
    expect(decide).toBeInTheDocument();
    expect(box).toHaveFocus();
  });

  it("typing_lists_the_matching_entries_of_every_group", () => {
    openCatalog(AFTER_FETCH);

    search("retry");

    const entries = screen.getAllByRole("option");
    const retry = screen.getByRole("option", {
      name: /^Retry “Fetch the digest” if it fails/,
    });
    const tryIt = screen.getByRole("option", {
      name: /^Try and handle failure/,
    });
    expect(entries).toEqual([retry, tryIt]);
  });

  it("nothing_is_said_before_the_person_types", () => {
    openCatalog(AFTER_FETCH);

    const said = screen.getByRole("status");

    expect(said).toBeEmptyDOMElement();
  });

  it("the_count_of_matches_is_said_politely_while_searching", () => {
    openCatalog(AFTER_FETCH);

    search("loop");

    const said = screen.getByRole("status");
    expect(said).toHaveTextContent("1 kind of step");
  });

  it("a_search_that_matches_nothing_points_slack_to_the_url_step", () => {
    openCatalog(AFTER_FETCH);

    search("slack channel");

    const message = screen.getByText(
      "No kind of step matches “slack channel”.",
    );
    const hint = screen.getByText(
      "Tenon has no Slack or email step: post to their incoming-webhook address with “Fetch or send to a URL”.",
    );
    expect(message).toBeVisible();
    expect(hint).toBeVisible();
  });

  it("the_first_match_is_active_and_enter_chooses_it", () => {
    const { onChoose } = openCatalog(AFTER_FETCH);
    search("wait");

    press("Enter");

    expect(onChoose).toHaveBeenCalledExactlyOnceWith({
      kind: "insertStep",
      variant: "wait",
    });
  });

  it("down_makes_the_next_entry_the_active_one", () => {
    openCatalog(AFTER_FETCH);

    press("ArrowDown");

    const box = searchBox();
    const choose = screen.getByRole("option", { name: /^Choose a path/ });
    expect(box).toHaveAttribute("aria-activedescendant", choose.id);
  });

  it("clicking_an_entry_chooses_what_it_does", () => {
    const { onChoose } = openCatalog(AFTER_FETCH);
    const start = screen.getByRole("option", {
      name: /^Change how the workflow starts/,
    });

    fireEvent.click(start);

    expect(onChoose).toHaveBeenCalledExactlyOnceWith({ kind: "changeStart" });
  });

  it("the_retry_entry_sets_three_growing_retries_on_the_step_above", () => {
    const { onChoose } = openCatalog(AFTER_FETCH);
    const retry = screen.getByRole("option", {
      name: /^Retry “Fetch the digest” if it fails/,
    });

    fireEvent.click(retry);

    expect(onChoose).toHaveBeenCalledExactlyOnceWith({
      kind: "setFailure",
      failure: {
        kind: "retry",
        retry: {
          retries: 3,
          milliseconds: 2000,
          backoff: "exponential",
          on: { kind: "any" },
        },
      },
    });
  });

  it("with_no_step_above_no_retry_is_offered", () => {
    openCatalog(AFTER_THE_START);

    const retry = screen.queryByRole("option", { name: /^Retry/ });

    expect(retry).not.toBeInTheDocument();
  });

  it("a_kind_the_host_does_not_run_is_not_offered", () => {
    openCatalog(HOST_WITHOUT_SHELL);

    search("shell");

    const shell = screen.queryByRole("option", {
      name: /^Run a shell command/,
    });
    expect(shell).not.toBeInTheDocument();
  });
});
