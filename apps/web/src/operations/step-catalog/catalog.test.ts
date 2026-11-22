import type { StepVariant } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import { catalogOf, entryWordsOf } from "./catalog";
import { TENON_VARIANTS, WITHOUT_SHELL } from "./hosts.test-support";
import type { CatalogEntry, CatalogGroup, EntryId } from "./interfaces";

function outlineOf(catalog: readonly CatalogGroup[]) {
  return catalog.map(({ id, entries }) => {
    const listed = entries.map((entry) => entry.id);
    return { id, listed };
  });
}

function entryOf(catalog: readonly CatalogGroup[], id: EntryId): CatalogEntry {
  const entries = catalog.flatMap((group) => group.entries);
  const found = entries.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`The catalog has no ${id}.`);
  return found;
}

describe("the step catalog of a host", () => {
  it("tenons_entries_stand_in_their_groups_with_common_first", () => {
    const catalog = catalogOf(TENON_VARIANTS);

    const outline = outlineOf(catalog);
    expect(outline).toEqual([
      {
        id: "common",
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
      { id: "decide", listed: ["fork", "do", "try"] },
      { id: "code", listed: ["script-python", "shell", "workflow"] },
      { id: "events", listed: ["listen", "emit", "raise"] },
      {
        id: "developers",
        listed: ["openapi", "mcp", "grpc", "asyncapi", "a2a"],
      },
    ]);
  });

  it("an_entry_carries_its_words_example_synonyms_language_term_icon_and_variant", () => {
    const catalog = catalogOf(TENON_VARIANTS);

    const fetch = entryOf(catalog, "http");
    expect(fetch).toEqual({
      id: "http",
      title: "Fetch or send to a URL",
      description:
        "Get data from a web address, or send data to it — also how you post to Slack, Teams or email services",
      example: "GET https://api.example.com/orders",
      synonyms: [
        "http",
        "url",
        "api",
        "rest",
        "request",
        "get",
        "post",
        "fetch",
        "download",
        "webhook",
        "call",
        "slack",
        "teams",
        "discord",
        "chat",
        "email",
        "notify",
        "message",
        "send",
      ],
      languageTerm: "call: http",
      icon: "globe",
      action: { kind: "insertStep", variant: "http" },
    });
  });

  it("the_groups_are_titled_in_plain_words", () => {
    const catalog = catalogOf(TENON_VARIANTS);

    const titles = catalog.map((group) => group.title);
    expect(titles).toEqual([
      "Common",
      "Decide and repeat",
      "Run code",
      "Wait and events",
      "For developers",
    ]);
  });

  it("a_host_that_runs_containers_lists_run_a_container_after_the_shell", () => {
    const variants: readonly StepVariant[] = [
      "script-python",
      "shell",
      "container",
    ];

    const catalog = catalogOf(variants);

    const outline = outlineOf(catalog);
    expect(outline).toEqual([
      { id: "common", listed: ["start"] },
      { id: "code", listed: ["script-python", "shell", "container"] },
    ]);
  });

  it("running_a_container_runs_an_image_and_uses_its_output", () => {
    const catalog = catalogOf(["container"]);

    const container = entryOf(catalog, "container");
    expect(container).toEqual({
      id: "container",
      title: "Run a container",
      description: "Run an image and use its output",
      example: "alpine:3.20",
      synonyms: ["docker", "container", "image"],
      languageTerm: "run: container",
      icon: "container",
      action: { kind: "insertStep", variant: "container" },
    });
  });

  it("an_entry_whose_variant_the_host_does_not_run_is_absent", () => {
    const catalog = catalogOf(WITHOUT_SHELL);

    const outline = outlineOf(catalog);
    expect(outline).toContainEqual({
      id: "code",
      listed: ["script-python", "workflow"],
    });
  });

  it("a_group_left_empty_is_absent", () => {
    const catalog = catalogOf(["http", "fork"]);

    const outline = outlineOf(catalog);
    expect(outline).toEqual([
      { id: "common", listed: ["http", "start"] },
      { id: "decide", listed: ["fork"] },
    ]);
  });

  it("changing_the_start_is_offered_on_a_host_that_runs_no_step", () => {
    const catalog = catalogOf([]);

    const outline = outlineOf(catalog);
    expect(outline).toEqual([{ id: "common", listed: ["start"] }]);
  });

  it("changing_the_start_opens_the_start_form", () => {
    const catalog = catalogOf([]);

    const start = entryOf(catalog, "start");
    expect(start).toEqual({
      id: "start",
      title: "Change how the workflow starts",
      description: "By hand, on a schedule, by a webhook or an event",
      example: "Every day at 09:00 UTC",
      synonyms: [
        "schedule",
        "trigger",
        "cron",
        "every",
        "daily",
        "hourly",
        "webhook",
        "start",
        "when",
      ],
      languageTerm: "schedule",
      icon: "calendar-clock",
      action: { kind: "changeStart" },
    });
  });

  it("retrying_a_step_sets_its_failure_to_three_growing_retries_two_seconds_apart", () => {
    const catalog = catalogOf(["try"]);

    const retry = entryOf(catalog, "retry");
    expect(retry).toEqual({
      id: "retry",
      title: "Retry a step if it fails",
      description: "Try the step before this one again when it fails",
      example: "3 times, 2 s apart, growing",
      synonyms: ["retry", "again", "on failure", "error", "fallback"],
      languageTerm: "try · catch.retry",
      icon: "rotate-cw",
      action: {
        kind: "setFailure",
        failure: { kind: "retry", retries: 3, seconds: 2, growing: true },
      },
    });
  });

  it("retrying_is_absent_where_the_host_does_not_run_try", () => {
    const catalog = catalogOf(["http"]);

    const outline = outlineOf(catalog);
    expect(outline).toEqual([{ id: "common", listed: ["http", "start"] }]);
  });
});

describe("the words of an entry at a plus", () => {
  const catalog = catalogOf(TENON_VARIANTS);

  it("the_retry_entry_names_the_step_above_the_plus", () => {
    const retry = entryOf(catalog, "retry");

    const words = entryWordsOf(retry, "Fetch the digest");

    expect(words).toEqual({
      title: "Retry “Fetch the digest” if it fails",
      description: "Wraps the step above this + in a Try",
    });
  });

  it("the_retry_entry_keeps_its_own_words_where_no_step_is_above_the_plus", () => {
    const retry = entryOf(catalog, "retry");

    const words = entryWordsOf(retry, null);

    expect(words).toEqual({
      title: "Retry a step if it fails",
      description: "Try the step before this one again when it fails",
    });
  });

  it("another_entry_keeps_its_own_words_below_a_step", () => {
    const wait = entryOf(catalog, "wait");

    const words = entryWordsOf(wait, "Fetch the digest");

    expect(words).toEqual({ title: "Wait", description: "Pause for a while" });
  });
});
