import { describe, expect, it } from "vitest";
import { catalogOf } from "./catalog";
import { TENON_VARIANTS } from "./hosts.test-support";
import type { EntryId, GroupId, ShownGroup } from "./interfaces";
import { foundText, keyboardOrderOf, noMatchOf, shownGroupsOf } from "./search";

const STEP_ABOVE = "Fetch the digest";

const CATALOG = catalogOf(TENON_VARIANTS, STEP_ABOVE);

const NONE_OPENED: ReadonlySet<GroupId> = new Set();

const DEVELOPERS_OPENED: ReadonlySet<GroupId> = new Set(["developers"]);

function outlineOf(groups: readonly ShownGroup[]) {
  return groups.map(({ id, open, entries }) => {
    const listed = entries.map(({ entry }) => entry.id);
    return { id, open, listed };
  });
}

function openingOf(groups: readonly ShownGroup[]) {
  return groups.map(({ id, open }) => ({ id, open }));
}

function foundOf(groups: readonly ShownGroup[]) {
  const entries = groups.flatMap((group) => group.entries);
  return entries.map(({ entry, termMatched }) => ({
    id: entry.id,
    termMatched,
  }));
}

describe("the catalog shown for a search", () => {
  it("without_a_query_every_entry_is_shown_and_only_common_is_open", () => {
    const groups = shownGroupsOf(CATALOG, "", NONE_OPENED);

    const outline = outlineOf(groups);
    expect(outline).toEqual([
      {
        id: "common",
        open: true,
        listed: [
          "http",
          "switch",
          "for",
          "set",
          "wait",
          "script-js",
          "retry",
          "start",
        ],
      },
      { id: "decide", open: false, listed: ["fork", "do", "try"] },
      {
        id: "code",
        open: false,
        listed: ["script-python", "shell", "workflow"],
      },
      { id: "events", open: false, listed: ["listen", "emit", "raise"] },
      {
        id: "developers",
        open: false,
        listed: ["openapi", "mcp", "grpc", "asyncapi", "a2a"],
      },
    ]);
  });

  it("a_group_the_person_opened_is_open_beside_common", () => {
    const groups = shownGroupsOf(CATALOG, "", DEVELOPERS_OPENED);

    const opening = openingOf(groups);
    expect(opening).toEqual([
      { id: "common", open: true },
      { id: "decide", open: false },
      { id: "code", open: false },
      { id: "events", open: false },
      { id: "developers", open: true },
    ]);
  });

  it("a_query_of_spaces_is_no_query", () => {
    const groups = shownGroupsOf(CATALOG, "   ", NONE_OPENED);

    const opening = openingOf(groups);
    expect(opening).toEqual([
      { id: "common", open: true },
      { id: "decide", open: false },
      { id: "code", open: false },
      { id: "events", open: false },
      { id: "developers", open: false },
    ]);
  });

  it("a_query_opens_every_group_that_keeps_a_match_and_drops_the_others", () => {
    const groups = shownGroupsOf(CATALOG, "script", NONE_OPENED);

    const outline = outlineOf(groups);
    expect(outline).toEqual([
      { id: "common", open: true, listed: ["script-js"] },
      { id: "code", open: true, listed: ["script-python"] },
    ]);
  });

  it.each<[string, readonly EntryId[]]>([
    ["SLACK", ["http"]],
    ["post slack", ["http"]],
    ["choose path", ["switch"]],
    ["call: mcp", ["mcp"]],
    ["at the same time", ["fork"]],
    ["post bash", []],
  ])(
    "every_word_of_%j_is_found_in_a_title_language_term_or_synonym_in_any_case",
    (query, ids) => {
      const groups = shownGroupsOf(CATALOG, query, NONE_OPENED);

      const found = foundOf(groups);
      const matched = found.map(({ id }) => id);
      expect(matched).toEqual(ids);
    },
  );

  it.each<[string, readonly { id: EntryId; termMatched: boolean }[]]>([
    ["call http", [{ id: "http", termMatched: true }]],
    ["fetch", [{ id: "http", termMatched: false }]],
    [
      "retry",
      [
        { id: "retry", termMatched: true },
        { id: "try", termMatched: false },
      ],
    ],
  ])(
    "an_entry_found_by_%j_says_whether_its_language_term_holds_every_word",
    (query, marked) => {
      const groups = shownGroupsOf(CATALOG, query, NONE_OPENED);

      const found = foundOf(groups);
      expect(found).toEqual(marked);
    },
  );

  it("without_a_query_no_language_term_is_marked", () => {
    const groups = shownGroupsOf(CATALOG, "", NONE_OPENED);

    const found = foundOf(groups);
    const marked = found.filter(({ termMatched }) => termMatched);
    expect(marked).toEqual([]);
  });
});

describe("the keyboard order of the catalog", () => {
  it("without_a_query_the_keys_move_through_the_open_groups_only", () => {
    const groups = shownGroupsOf(CATALOG, "", DEVELOPERS_OPENED);

    const order = keyboardOrderOf(groups);

    const ids = order.map(({ entry }) => entry.id);
    expect(ids).toEqual([
      "http",
      "switch",
      "for",
      "set",
      "wait",
      "script-js",
      "retry",
      "start",
      "openapi",
      "mcp",
      "grpc",
      "asyncapi",
      "a2a",
    ]);
  });

  it("with_a_query_the_keys_move_through_every_match", () => {
    const groups = shownGroupsOf(CATALOG, "script", NONE_OPENED);

    const order = keyboardOrderOf(groups);

    const ids = order.map(({ entry }) => entry.id);
    expect(ids).toEqual(["script-js", "script-python"]);
  });
});

describe("the words when the search finds nothing", () => {
  it("the_note_names_the_query_and_suggests_words_that_find_steps", () => {
    const note = noMatchOf("  xyz ");

    expect(note).toEqual({
      message: "No kind of step matches “xyz”.",
      hint: "Try “http”, “if”, “loop”, “wait” or “script”.",
    });
  });

  it.each(["Slack bot", "gmail", "Teams meeting", "discord server", "chatbot"])(
    "a_search_for_%j_is_pointed_to_fetch_or_send_to_a_url",
    (query) => {
      const note = noMatchOf(query);

      expect(note.hint).toBe(
        "Tenon has no Slack or email step: post to their incoming-webhook address with “Fetch or send to a URL”.",
      );
    },
  );

  it.each([
    [0, "No kind of step matches"],
    [1, "1 kind of step"],
    [12, "12 kinds of step"],
  ])("%i_found_is_announced_as_%j", (count, text) => {
    const announced = foundText(count);

    expect(announced).toBe(text);
  });
});
