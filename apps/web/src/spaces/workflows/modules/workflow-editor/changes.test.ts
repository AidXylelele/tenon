import type { Step, StepList } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import { changesOf } from "./changes";
import { versionChoicesOf } from "./version";

function stepOf(name: string, summary: string): Step {
  return {
    id: `/do/${name}`,
    pointer: `/do/0/${name}`,
    name,
    kind: "call",
    variant: "http",
    family: "call",
    summary,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists: [],
    flow: [],
    catch: null,
  };
}

function listOf(steps: readonly Step[]): StepList {
  return { id: "/do", pointer: "/do", role: "sequence", steps };
}

describe("what changed since the published version", () => {
  it("names_the_steps_added_changed_and_removed", () => {
    const before = listOf([stepOf("fetch", "GET a"), stepOf("post", "POST b")]);
    const after = listOf([
      stepOf("fetch", "GET a2"),
      stepOf("notify", "POST c"),
    ]);

    const changes = changesOf(before, after);

    expect(changes).toEqual([
      { name: "notify", kind: "added" },
      { name: "fetch", kind: "changed" },
      { name: "post", kind: "removed" },
    ]);
  });

  it("offers_a_fix_a_feature_and_a_breaking_change", () => {
    const choices = versionChoicesOf("1.4.2").map((each) => each.version);

    expect(choices).toEqual(["1.4.3", "1.5.0", "2.0.0"]);
  });
});
