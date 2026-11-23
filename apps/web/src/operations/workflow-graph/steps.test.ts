import type { Step, StepList } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import { placeOf, stepAt, stepWithId } from "./steps";

function step(
  id: string,
  from: number,
  to: number,
  lists: Step["lists"] = [],
): Step {
  const range = {
    start: { line: from, character: 2 },
    end: { line: to, character: 0 },
  };
  return {
    variant: null,
    catch: null,
    id,
    pointer: id,
    name: id.split("/").at(-1) ?? id,
    kind: lists.length === 0 ? "set" : "for",
    family: "data",
    summary: null,
    milliseconds: null,
    note: null,
    range,
    selectionRange: range,
    lists,
    flow: [],
  };
}

const inner = step("/do/each/do/inner", 5, 7);
const each = step("/do/each", 4, 8, [
  {
    id: "/do/each/do",
    pointer: "/do/each/do",
    role: "sequence",
    part: "do",
    steps: [inner],
  },
]);
const fetch = step("/do/fetch", 1, 3);
const STEPS: StepList = {
  id: "/do",
  pointer: "/do",
  role: "sequence",
  steps: [fetch, each],
};

describe("the steps of a structure", () => {
  it("a_position_lands_on_the_deepest_step_that_holds_it", () => {
    const at = stepAt(STEPS, { line: 6, character: 4 });
    const outside = stepAt(STEPS, { line: 0, character: 0 });

    expect(at?.id).toBe("/do/each/do/inner");
    expect(outside).toBeNull();
  });

  it("a_step_is_found_by_its_id_and_placed_in_its_own_list", () => {
    const found = stepWithId(STEPS, "/do/each/do/inner");
    const place = placeOf(STEPS, "/do/each");

    expect(found).toBe(inner);
    expect(place).toEqual({ list: "/do", index: 1, size: 2 });
  });
});
