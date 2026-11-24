import type { Step } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@/libs/data-access/types";
import { progressOf, recordsOf } from "./progress";

function stepOf(id: string, pointer: string, lists: Step["lists"] = []): Step {
  return {
    variant: null,
    catch: null,
    id,
    pointer,
    name: id.split("/").at(-1) ?? id,
    kind: lists.length === 0 ? "call" : "for",
    family: "call",
    summary: null,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists,
    flow: [],
  };
}

const notify = stepOf("/do/each/do/notify", "/do/1/each/do/0/notify");
const each = stepOf("/do/each", "/do/1/each", [
  {
    id: "/do/each/do",
    pointer: "/do/1/each/do",
    role: "sequence",
    part: "do",
    steps: [notify],
  },
]);
const fetch = stepOf("/do/fetch", "/do/0/fetch");
const STEPS = [fetch, each, notify];

const record = (
  reference: string,
  status: TaskRecord["status"],
  execution = reference,
): TaskRecord => ({
  execution,
  reference,
  name: reference.split("/").at(-1) ?? "",
  status,
  error: null,
  startedAt: "2026-11-03T10:00:00Z",
  endedAt: null,
  attempt: 1,
  input: null,
  output: null,
  retryAt: null,
});

describe("the progress of a run by step", () => {
  it("a_step_that_ran_again_shows_its_latest_status_and_its_count", () => {
    const records = [
      record("/do/0/fetch", "faulted"),
      record("/do/0/fetch", "completed", "/do/0/fetch@1"),
    ];

    const progress = progressOf(records, STEPS);

    expect(progress.get("/do/fetch")).toEqual({ status: "completed", runs: 2 });
  });

  it("a_block_without_its_own_record_shows_its_latest_step", () => {
    const records = [record("/do/1/each/do/0/notify", "running")];

    const progress = progressOf(records, STEPS);

    expect(progress.get("/do/each")).toEqual({ status: "running", runs: 1 });
  });

  it("a_block's_records_are_its_own_and_its_steps'", () => {
    const records = [
      record("/do/0/fetch", "completed"),
      record("/do/1/each/do/0/notify", "running"),
    ];

    const held = recordsOf(records, [each, notify]);

    expect(held.map((each) => each.reference)).toEqual([
      "/do/1/each/do/0/notify",
    ]);
  });
});
