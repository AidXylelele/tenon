import { describe, expect, it } from "vitest";
import { jumpLineOf, sideRoomOf } from "./geometry";
import type { Jump } from "./interfaces";

describe("the line of a jump", () => {
  const jump: Jump = {
    key: "case:/do/Which kind?:A parcel",
    list: "/do",
    from: "/do/Which kind?",
    fromName: "Which kind?",
    to: "/do/Book the courier",
    between: [],
    lane: 1,
    case: "A parcel",
  };

  it("leaves_the_source_to_the_right_runs_beside_the_widest_step_between_and_enters_the_target_from_the_right", () => {
    const boxes = {
      jump,
      source: { left: 100, right: 440, top: 200, bottom: 240 },
      target: { left: 130, right: 410, top: 400, bottom: 470 },
      between: [
        { left: 100, right: 440, top: 120, bottom: 260 },
        { left: 40, right: 500, top: 316, bottom: 380 },
      ],
    };

    const line = jumpLineOf(boxes);

    expect(line).toEqual({
      key: "case:/do/Which kind?:A parcel",
      path: "M 440 220 H 534 V 424 H 416",
      arrow: "M 419 420 L 413 424 L 419 428",
    });
  });
});

describe("the room beside the flow", () => {
  it("leaves_a_lane_for_each_jump", () => {
    const room = sideRoomOf(3);

    expect(room).toBe(94);
  });
});
